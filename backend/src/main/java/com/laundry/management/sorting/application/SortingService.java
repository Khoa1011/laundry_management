package com.laundry.management.sorting.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.common.exception.*;
import com.laundry.management.order.domain.*;
import com.laundry.management.order.infrastructure.*;
import com.laundry.management.servicecatalog.domain.SharingMode;
import com.laundry.management.servicecatalog.domain.UnitType;
import com.laundry.management.sorting.api.SortingDtos;
import com.laundry.management.sorting.domain.ProcessingGroup;
import com.laundry.management.sorting.domain.SortingAttributes.*;
import com.laundry.management.sorting.infrastructure.ProcessingGroupRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SortingService {
    private static final String READ = "@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).SORTING_READ)";
    private static final String PROCESS = "@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).SORTING_PROCESS)";
    private final OrderRepository orders;
    private final OrderBagRepository bags;
    private final ProcessingGroupRepository groups;
    private final OrderHistoryRepository history;
    private final UserAccountRepository userAccounts;
    private final CurrentUserProvider users;
    private final ObjectMapper json;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public SortingService(OrderRepository orders, OrderBagRepository bags, ProcessingGroupRepository groups,
        OrderHistoryRepository history, UserAccountRepository userAccounts, CurrentUserProvider users,
        ObjectMapper json, ApplicationEventPublisher events, Clock clock) {
        this.orders = orders; this.bags = bags; this.groups = groups; this.history = history;
        this.userAccounts = userAccounts; this.users = users; this.json = json; this.events = events; this.clock = clock;
    }

    @PreAuthorize(PROCESS)
    @Transactional(readOnly = true)
    public SortingDtos.BagContext scan(String code, Long requestedBranch) {
        Long branchId = users.resolveAuthorizedBranch(requestedBranch);
        String value = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        if (value.isEmpty() || value.length() > 64) throw missing();
        OrderBag bag;
        if (value.matches("B[0-9]{1,18}")) {
            try { bag = bags.findByIdAndOrderBranchId(Long.parseLong(value.substring(1)), branchId).orElseThrow(this::missing); }
            catch (NumberFormatException ex) { throw missing(); }
        } else bag = bags.findByBagCodeAndOrderBranchId(value, branchId).orElseThrow(this::missing);
        return context(bag);
    }

    @PreAuthorize(READ)
    @Transactional(readOnly = true)
    public SortingDtos.Group scanGroup(String code, Long requestedBranch) {
        Long branchId = users.resolveAuthorizedBranch(requestedBranch);
        String value = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        if (value.isEmpty() || value.length() > 80) throw missing();
        ProcessingGroup group;
        if (value.matches("G[0-9]{1,18}")) {
            try { group = groups.findByIdAndBagOrderBranchId(Long.parseLong(value.substring(1)), branchId).orElseThrow(this::missing); }
            catch (NumberFormatException ex) { throw missing(); }
        } else group = groups.findByGroupCodeAndBagOrderBranchId(value, branchId).orElseThrow(this::missing);
        return group(group);
    }

    @PreAuthorize(PROCESS)
    @Transactional
    public SortingDtos.BagContext confirm(Long bagId, Long requestedBranch, SortingDtos.ConfirmRequest request) {
        Long branchId = users.resolveAuthorizedBranch(requestedBranch);
        OrderBag reference = bags.findByIdAndOrderBranchId(bagId, branchId).orElseThrow(this::missing);
        LaundryOrder order = orders.findForUpdate(reference.getOrder().getId(), branchId).orElseThrow(this::missing);
        OrderBag bag = bags.findForUpdate(bagId, order.getId()).orElseThrow(this::missing);
        requireVersion(bag, request.bagVersion());
        if (order.getStatus() != OrderStatus.RECEIVED || bag.getStatus() != OrderBagStatus.RECEIVED)
            throw invalidBag("Chỉ có thể phân loại túi chưa phân loại của đơn đã nhận.");
        if (request.groups() == null || request.groups().isEmpty())
            throw invalidAllocation("Hãy thêm ít nhất một nhóm đồ trước khi xác nhận.");
        Map<Long, OrderItem> items = order.getItems().stream().collect(Collectors.toMap(OrderItem::getId, item -> item));
        Map<Long, BigDecimal> allocated = new HashMap<>();
        for (ProcessingGroup existing : groups.findByBagOrderIdAndStatus(order.getId(), GroupStatus.WAITING))
            allocated.merge(existing.getItem().getId(), existing.getQuantity(), BigDecimal::add);
        for (SortingDtos.Draft draft : request.groups()) {
            OrderItem item = items.get(draft.orderItemId());
            if (item == null) throw invalidAllocation("Dòng dịch vụ đã chọn không thuộc đơn này.");
            if (draft.quantity() == null || draft.quantity().signum() <= 0 || draft.quantity().scale() > 3)
                throw invalidAllocation("Số lượng nhóm đồ phải lớn hơn 0 và có tối đa 3 chữ số thập phân.");
            if (draft.colorGroup() == null || draft.fabricCare() == null || draft.washMode() == null
                || draft.temperatureProfile() == null || draft.detergentProfile() == null
                || draft.softenerProfile() == null || draft.hygieneLevel() == null
                || draft.dryingInstruction() == null || draft.separateWash() == null)
                throw invalidAllocation("Hãy điền đủ thông tin xử lý của từng nhóm đồ.");
            if (mandatorySeparate(item) && !draft.separateWash())
                throw invalidAllocation("Loại đồ này bắt buộc giặt riêng và không thể ghép.");
            allocated.merge(item.getId(), draft.quantity(), BigDecimal::add);
            if (allocated.get(item.getId()).compareTo(item.getQuantity()) > 0)
                throw invalidAllocation("Dịch vụ " + item.getServiceNameSnapshot() + " đang vượt "
                    + allocated.get(item.getId()).subtract(item.getQuantity()).toPlainString() + " " + unitLabel(item.getUnitTypeSnapshot()) + " so với đơn.");
        }
        if (bags.countByOrderIdAndStatus(order.getId(), OrderBagStatus.RECEIVED) == 1) {
            for (OrderItem item : order.getItems()) {
                BigDecimal remaining = item.getQuantity().subtract(allocated.getOrDefault(item.getId(), BigDecimal.ZERO));
                if (remaining.signum() != 0)
                    throw invalidAllocation(item.getServiceNameSnapshot() + " còn thiếu " + remaining.toPlainString()
                        + " " + unitLabel(item.getUnitTypeSnapshot()) + " chưa được phân loại.");
            }
        }
        int sequence = groups.findFirstByBagIdOrderBySequenceNumberDesc(bagId)
            .map(value -> value.getSequenceNumber() + 1).orElse(1);
        UserAccount actor = actor();
        List<ProcessingGroup> created = new ArrayList<>();
        for (SortingDtos.Draft draft : request.groups()) {
            created.add(new ProcessingGroup(bag, items.get(draft.orderItemId()), sequence++, draft.quantity(),
                draft.colorGroup(), draft.fabricCare(), draft.washMode(), draft.temperatureProfile(),
                draft.detergentProfile(), draft.softenerProfile(), draft.hygieneLevel(), draft.separateWash(),
                draft.dryingInstruction(), clean(draft.note()), actor));
        }
        groups.saveAllAndFlush(created);
        bag.markSorted(actor, Instant.now(clock)); bags.flush();
        record(order, bag, OrderHistoryAction.BAG_SORTED, null,
            Map.of("groupCodes", created.stream().map(ProcessingGroup::getGroupCode).toList(),
                "groupCount", created.size()), actor);
        publish(bag, "sorting.confirmed");
        return context(bag);
    }

    @PreAuthorize(PROCESS)
    @Transactional
    public SortingDtos.BagContext reopen(Long bagId, Long requestedBranch, SortingDtos.ReopenRequest request) {
        Long branchId = users.resolveAuthorizedBranch(requestedBranch);
        OrderBag reference = bags.findByIdAndOrderBranchId(bagId, branchId).orElseThrow(this::missing);
        LaundryOrder order = orders.findForUpdate(reference.getOrder().getId(), branchId).orElseThrow(this::missing);
        OrderBag bag = bags.findForUpdate(bagId, order.getId()).orElseThrow(this::missing);
        requireVersion(bag, request.bagVersion());
        if (order.getStatus() != OrderStatus.RECEIVED || bag.getStatus() != OrderBagStatus.SORTED)
            throw invalidBag("Chỉ có thể mở lại túi đã phân loại khi đơn còn ở trạng thái đã nhận.");
        String reason = clean(request.reason());
        if (reason == null || reason.length() > 500) throw invalidAllocation("Hãy nhập lý do tối đa 500 ký tự.");
        List<ProcessingGroup> current = groups.findByBagIdOrderBySequenceNumberAsc(bagId).stream()
            .filter(value -> value.getStatus() == GroupStatus.WAITING).toList();
        if (current.isEmpty()) throw invalidBag("Túi này không còn nhóm đồ đang chờ để phân loại lại.");
        UserAccount actor = actor(); Instant now = Instant.now(clock);
        current.forEach(group -> group.voidGroup(actor, now, reason)); groups.flush();
        bag.reopenSorting(actor); bags.flush();
        record(order, bag, OrderHistoryAction.BAG_SORTING_REOPENED, reason,
            Map.of("voidedGroupCodes", current.stream().map(ProcessingGroup::getGroupCode).toList()), actor);
        publish(bag, "sorting.reopened");
        return context(bag);
    }

    @PreAuthorize(PROCESS)
    @Transactional
    public SortingDtos.Group requestPrint(Long groupId, Long requestedBranch) {
        Long branchId = users.resolveAuthorizedBranch(requestedBranch);
        ProcessingGroup reference = groups.findByIdAndBagOrderBranchId(groupId, branchId).orElseThrow(this::missing);
        LaundryOrder order = orders.findForUpdate(reference.getBag().getOrder().getId(), branchId).orElseThrow(this::missing);
        ProcessingGroup group = groups.findByIdAndBagOrderBranchId(groupId, branchId).orElseThrow(this::missing);
        if (group.getStatus() != GroupStatus.WAITING)
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.SORTING_GROUP_NOT_PRINTABLE,
                "Group label unavailable", "Voided groups cannot be printed.");
        UserAccount actor = actor(); group.recordPrintRequest(actor, Instant.now(clock)); groups.flush();
        record(order, group.getBag(), OrderHistoryAction.GROUP_LABEL_PRINT_REQUESTED, null,
            Map.of("groupCode", group.getGroupCode(), "printRequestCount", group.getPrintRequestCount()), actor);
        return group(group);
    }

    @PreAuthorize(READ)
    @Transactional(readOnly = true)
    public SortingDtos.PageResponse waiting(Long requestedBranch, String search, Long serviceId, Long itemTypeId,
        ColorGroup color, WashMode washMode, Boolean separateWash, Instant promisedFrom, Instant promisedTo,
        int page, int size) {
        if (size < 1 || size > 100) throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.PAGE_SIZE_EXCEEDED,
            "Invalid page size", "Use a page size between 1 and 100.");
        Long branchId = users.resolveAuthorizedBranch(requestedBranch);
        String pattern = search == null || search.isBlank() ? null : "%" + escape(search.trim().toLowerCase(Locale.ROOT)) + "%";
        Page<ProcessingGroup> result = groups.searchWaiting(branchId, GroupStatus.WAITING, pattern,
            serviceId, itemTypeId, color, washMode, separateWash, promisedFrom, promisedTo,
            PageRequest.of(Math.max(page, 0), size, Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("id"))));
        return new SortingDtos.PageResponse(result.stream().map(this::group).toList(), result.getNumber(),
            result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @PreAuthorize(READ)
    @Transactional(readOnly = true)
    public SortingDtos.Stats stats(Long requestedBranch) {
        Long branchId = users.resolveAuthorizedBranch(requestedBranch);
        return new SortingDtos.Stats(groups.countByBagOrderBranchIdAndStatus(branchId, GroupStatus.WAITING),
            groups.countShareable(branchId, GroupStatus.WAITING, ColorGroup.UNKNOWN, FabricCare.UNKNOWN),
            groups.countByBagOrderBranchIdAndStatusAndSeparateWash(branchId, GroupStatus.WAITING, true));
    }

    @PreAuthorize(READ)
    @Transactional(readOnly = true)
    public SortingDtos.FilterOptions filterOptions(Long requestedBranch) {
        Long branchId = users.resolveAuthorizedBranch(requestedBranch);
        return new SortingDtos.FilterOptions(
            groups.serviceOptions(branchId, GroupStatus.WAITING).stream()
                .map(row -> new SortingDtos.FilterOption((Long) row[0], (String) row[1])).toList(),
            groups.itemTypeOptions(branchId, GroupStatus.WAITING).stream()
                .map(row -> new SortingDtos.FilterOption((Long) row[0], (String) row[1])).toList());
    }

    private SortingDtos.BagContext context(OrderBag bag) {
        LaundryOrder order = bag.getOrder();
        Map<Long, BigDecimal> allocated = new HashMap<>();
        for (ProcessingGroup value : groups.findByBagOrderIdAndStatus(order.getId(), GroupStatus.WAITING))
            allocated.merge(value.getItem().getId(), value.getQuantity(), BigDecimal::add);
        List<SortingDtos.Item> items = order.getItems().stream().map(item -> {
            BigDecimal already = allocated.getOrDefault(item.getId(), BigDecimal.ZERO);
            return new SortingDtos.Item(item.getId(), item.getServiceCodeSnapshot(), item.getServiceNameSnapshot(),
                item.getItemTypeCodeSnapshot(), item.getItemTypeNameSnapshot(), item.getServiceId(), item.getItemTypeId(),
                item.getUnitTypeSnapshot(), item.getSharingModeSnapshot(), mandatorySeparate(item),
                item.getQuantity(), already, item.getQuantity().subtract(already));
        }).toList();
        return new SortingDtos.BagContext(bag.getId(), bag.getBagCode(), bag.getSequenceNumber(),
            Math.toIntExact(bags.countByOrderIdAndStatusIn(order.getId(), List.of(OrderBagStatus.RECEIVED, OrderBagStatus.SORTED))),
            bag.getStatus() == OrderBagStatus.RECEIVED && bags.countByOrderIdAndStatus(order.getId(), OrderBagStatus.RECEIVED) == 1,
            bag.getStatus(), bag.getVersion(), bag.getCreatedAt(), bag.getVoidReason(), order.getId(),
            order.getOrderCode(), order.getStatus(), order.getCustomerNameSnapshot(), order.getPromisedAt(),
            items, groups.findByBagIdOrderBySequenceNumberAsc(bag.getId()).stream().map(this::group).toList());
    }

    private SortingDtos.Group group(ProcessingGroup value) {
        OrderItem item = value.getItem(); OrderBag bag = value.getBag(); LaundryOrder order = bag.getOrder();
        return new SortingDtos.Group(value.getId(), value.getGroupCode(), "G" + value.getId(),
            item.getId(), bag.getId(), order.getOrderCode(), bag.getBagCode(), order.getCustomerNameSnapshot(),
            item.getServiceNameSnapshot(), item.getItemTypeNameSnapshot(), item.getServiceId(), item.getItemTypeId(),
            item.getUnitTypeSnapshot(), value.getQuantity(), value.getColorGroup(), value.getFabricCare(),
            value.getWashMode(), value.getTemperatureProfile(), value.getDetergentProfile(),
            value.getSoftenerProfile(), value.getHygieneLevel(), value.isSeparateWash(),
            value.getStatus() == GroupStatus.WAITING && !value.isSeparateWash()
                && value.getColorGroup() != ColorGroup.UNKNOWN && value.getFabricCare() != FabricCare.UNKNOWN,
            value.getDryingInstruction(), value.getNote(), value.getStatus(), value.getCreatedAt(),
            order.getPromisedAt(), value.getLastPrintRequestedAt(), value.getPrintRequestCount(),
            value.getVoidedAt(), value.getVoidReason(), value.getVersion());
    }

    private boolean mandatorySeparate(OrderItem item) {
        return item.getSharingModeSnapshot() == SharingMode.PRIVATE_LOAD
            || (item.getItemType() != null && item.getItemType().isRequiresSeparateWash());
    }
    private String unitLabel(UnitType unit) {
        return switch (unit) {
            case KG -> "kg";
            case ITEM -> "món";
            case PAIR -> "đôi";
            case SET -> "bộ";
            case LOAD -> "mẻ";
            case FIXED -> "lần";
        };
    }
    private void requireVersion(OrderBag bag, Long version) {
        if (version == null || bag.getVersion() != version)
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.SORTING_VERSION_CONFLICT,
                "Bag changed", "This bag was updated by another user. Reload and try again.");
    }
    private void record(LaundryOrder order, OrderBag bag, OrderHistoryAction action, String reason,
        Map<String, ?> metadata, UserAccount actor) {
        try {
            Map<String, Object> safe = new LinkedHashMap<>(metadata); safe.put("bagCode", bag.getBagCode());
            history.save(new OrderStatusHistory(order, action, order.getStatus(), order.getStatus(), reason,
                json.writeValueAsString(safe), OrderStatusSource.MANUAL_COMMAND, actor));
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR,
                "Sorting audit failed", "The sorting change could not be audited.");
        }
    }
    private void publish(OrderBag bag, String type) {
        events.publishEvent(new SortingChangedEvent(bag.getId(), bag.getBagCode(), bag.getOrder().getBranch().getId(),
            bag.getVersion(), type, Instant.now(clock)));
    }
    private UserAccount actor() { return userAccounts.findById(users.getRequired().id()).orElseThrow(this::missing); }
    private String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String escape(String value) { return value.replace("!", "!!").replace("%", "!%").replace("_", "!_"); }
    private ApiException missing() { return new ApiException(HttpStatus.NOT_FOUND, ErrorCode.SORTING_BAG_NOT_FOUND,
        "Sorting resource unavailable", "The requested bag or group was not found in your branch."); }
    private ApiException invalidBag(String detail) { return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.SORTING_BAG_NOT_ELIGIBLE, "Bag cannot be sorted", detail); }
    private ApiException invalidAllocation(String detail) { return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.SORTING_ALLOCATION_INVALID, "Invalid group allocation", detail); }
}
