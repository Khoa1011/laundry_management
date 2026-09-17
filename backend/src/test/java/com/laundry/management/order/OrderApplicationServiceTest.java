package com.laundry.management.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isA;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.auth.security.CurrentUser;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.customer.infrastructure.CustomerRepository;
import com.laundry.management.order.api.OrderDtos;
import com.laundry.management.order.application.OrderApplicationService;
import com.laundry.management.order.application.OrderChangedEvent;
import com.laundry.management.order.application.OrderMapper;
import com.laundry.management.order.application.OrderNumberGenerator;
import com.laundry.management.order.application.OrderTransitionPolicy;
import com.laundry.management.order.domain.LaundryOrder;
import com.laundry.management.order.domain.OrderItem;
import com.laundry.management.order.domain.OrderStatusHistory;
import com.laundry.management.order.domain.OrderStatus;
import com.laundry.management.order.infrastructure.OrderHistoryRepository;
import com.laundry.management.order.infrastructure.OrderRepository;
import com.laundry.management.servicecatalog.api.CatalogDtos;
import com.laundry.management.servicecatalog.application.PricingEngineService;
import com.laundry.management.servicecatalog.domain.PricingExplanationCode;
import com.laundry.management.servicecatalog.domain.PricingMethod;
import com.laundry.management.servicecatalog.domain.SharingMode;
import com.laundry.management.servicecatalog.domain.UnitType;
import com.laundry.management.servicecatalog.infrastructure.ItemTypeRepository;
import com.laundry.management.servicecatalog.infrastructure.LaundryServiceRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

class OrderApplicationServiceTest {
    private static final Instant EFFECTIVE_AT = Instant.parse("2026-09-16T10:15:30Z");
    private final OrderRepository orders = mock(OrderRepository.class);
    private final OrderHistoryRepository history = mock(OrderHistoryRepository.class);
    private final BranchRepository branches = mock(BranchRepository.class);
    private final CustomerRepository customers = mock(CustomerRepository.class);
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final LaundryServiceRepository services = mock(LaundryServiceRepository.class);
    private final ItemTypeRepository itemTypes = mock(ItemTypeRepository.class);
    private final PricingEngineService pricing = mock(PricingEngineService.class);
    private final OrderNumberGenerator numbers = mock(OrderNumberGenerator.class);
    private final OrderMapper mapper = mock(OrderMapper.class);
    private final CurrentUserProvider currentUsers = mock(CurrentUserProvider.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final OrderTransitionPolicy transitions = mock(OrderTransitionPolicy.class);
    private OrderApplicationService service;

    @BeforeEach
    void setUp() {
        service = new OrderApplicationService(orders, history, branches, customers, users, services,
            itemTypes, pricing, numbers, mapper, new ObjectMapper(), currentUsers, events, transitions,
            Clock.fixed(EFFECTIVE_AT, ZoneOffset.UTC));
        when(currentUsers.resolveAuthorizedBranch(7L)).thenReturn(7L);
        Branch branch = mock(Branch.class);
        when(branch.getId()).thenReturn(7L);
        when(branches.findById(7L)).thenReturn(Optional.of(branch));
        when(currentUsers.getRequired()).thenReturn(new CurrentUser(19L, "tester", "Tester", 7L,
            Set.of(), Set.of(), List.of(7L), 0));
        when(users.findById(19L)).thenReturn(Optional.of(mock(UserAccount.class)));
    }

    @Test
    void createUsesOneEffectiveAtForEveryLine() {
        AtomicReference<List<CatalogDtos.PricingPreviewRequest>> captured = new AtomicReference<>();
        RuntimeException stop = new RuntimeException("captured");
        when(pricing.quoteForOrder(anyList())).thenAnswer(invocation -> {
            captured.set(invocation.getArgument(0));
            throw stop;
        });

        assertThatThrownBy(() -> service.create(createRequest())).isSameAs(stop);
        assertThat(captured.get()).hasSize(2).allSatisfy(request ->
            assertThat(request.effectiveAt()).isEqualTo(EFFECTIVE_AT));
    }

    @Test
    void structuralRepriceUsesOneEffectiveAtForEveryLine() {
        LaundryOrder order = mock(LaundryOrder.class);
        Branch branch = mock(Branch.class);
        when(branch.getId()).thenReturn(7L);
        when(order.getBranch()).thenReturn(branch);
        when(order.getStatus()).thenReturn(OrderStatus.RECEIVED);
        when(order.getVersion()).thenReturn(3L);
        when(order.getItems()).thenReturn(List.of());
        when(orders.findForUpdate(11L, 7L)).thenReturn(Optional.of(order));
        AtomicReference<List<CatalogDtos.PricingPreviewRequest>> captured = new AtomicReference<>();
        RuntimeException stop = new RuntimeException("captured");
        when(pricing.quoteForOrder(anyList())).thenAnswer(invocation -> {
            captured.set(invocation.getArgument(0));
            throw stop;
        });
        OrderDtos.UpdateRequest request = new OrderDtos.UpdateRequest();
        request.setVersion(3L);
        request.setItems(items());

        assertThatThrownBy(() -> service.update(11L, 7L, request)).isSameAs(stop);
        assertThat(captured.get()).hasSize(2).allSatisfy(value ->
            assertThat(value.effectiveAt()).isEqualTo(EFFECTIVE_AT));
    }

    @Test
    void itemNoteOnlyUpdateNeverInvokesPricingAndStillTouchesAuditsAndPublishes() {
        LaundryOrder order = mock(LaundryOrder.class);
        OrderItem item = mock(OrderItem.class);
        Branch branch = mock(Branch.class);
        when(branch.getId()).thenReturn(7L);
        when(order.getId()).thenReturn(11L);
        when(order.getOrderCode()).thenReturn("OA-DH-000011");
        when(order.getBranch()).thenReturn(branch);
        when(order.getStatus()).thenReturn(OrderStatus.RECEIVED);
        when(order.getVersion()).thenReturn(3L);
        when(order.getItems()).thenReturn(List.of(item));
        when(item.getId()).thenReturn(41L);
        when(item.getNote()).thenReturn("Ghi chú cũ");
        when(item.getServiceCodeSnapshot()).thenReturn("WASH");
        when(item.getItemTypeCodeSnapshot()).thenReturn("SHIRT");
        when(orders.findForUpdate(11L, 7L)).thenReturn(Optional.of(order));
        OrderDtos.UpdateRequest request = new OrderDtos.UpdateRequest();
        request.setVersion(3L);
        request.setItemNoteUpdates(List.of(new OrderDtos.ItemNoteUpdate(41L, "Không dùng nước xả")));

        service.update(11L, 7L, request);

        verify(pricing, never()).quoteForOrder(anyList());
        verify(item).updateNote("Không dùng nước xả");
        verify(order).touch(any(UserAccount.class), org.mockito.ArgumentMatchers.eq(EFFECTIVE_AT));
        verify(history).save(isA(OrderStatusHistory.class));
        verify(orders).flush();
        verify(events).publishEvent(isA(OrderChangedEvent.class));
    }

    @Test
    void inconsistentAuthoritativeCurrenciesAreRejected() {
        when(pricing.quoteForOrder(anyList())).thenReturn(List.of(
            quote("VND", 2L, 3L), quote("USD", 4L, 5L)));

        assertThatThrownBy(() -> service.create(createRequest()))
            .isInstanceOfSatisfying(ApiException.class, exception ->
                assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ORDER_CURRENCY_CONFLICT));
    }

    private OrderDtos.CreateRequest createRequest() {
        return new OrderDtos.CreateRequest(7L, null, "Khách kiểm thử", "0903123456", null, null, items());
    }

    private List<OrderDtos.ItemRequest> items() {
        return List.of(
            new OrderDtos.ItemRequest(2L, 3L, SharingMode.ANY, 0, BigDecimal.ONE, null),
            new OrderDtos.ItemRequest(4L, 5L, SharingMode.ANY, 0, new BigDecimal("2"), null));
    }

    private CatalogDtos.PricingPreviewResponse quote(String currency, Long serviceId, Long itemTypeId) {
        BigDecimal amount = new BigDecimal("10000");
        CatalogDtos.PricingSnapshot snapshot = new CatalogDtos.PricingSnapshot(
            1L, "Bảng giá", 10L, 1, serviceId, "DV", "Dịch vụ", itemTypeId, "LD", "Loại đồ",
            PricingMethod.BY_ITEM, UnitType.ITEM, SharingMode.ANY, BigDecimal.ONE, BigDecimal.ONE,
            amount, amount, null, null, null, null, amount, BigDecimal.ZERO, BigDecimal.ZERO, amount,
            PricingExplanationCode.STANDARD_UNIT_PRICE, "Giá chuẩn", List.of(), EFFECTIVE_AT);
        return new CatalogDtos.PricingPreviewResponse(currency, 1L, "Bảng giá", 10L, 1, serviceId,
            "DV", "Dịch vụ", itemTypeId, "LD", "Loại đồ", PricingMethod.BY_ITEM, UnitType.ITEM,
            SharingMode.ANY, BigDecimal.ONE, BigDecimal.ONE, amount, amount, BigDecimal.ZERO,
            BigDecimal.ZERO, amount, EFFECTIVE_AT, PricingExplanationCode.STANDARD_UNIT_PRICE,
            "Giá chuẩn", List.of(), snapshot);
    }
}
