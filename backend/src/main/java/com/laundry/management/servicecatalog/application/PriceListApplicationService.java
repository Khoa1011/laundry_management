package com.laundry.management.servicecatalog.application;

import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.servicecatalog.api.CatalogDtos;
import com.laundry.management.servicecatalog.domain.CatalogStatus;
import com.laundry.management.servicecatalog.domain.ItemType;
import com.laundry.management.servicecatalog.domain.LaundryService;
import com.laundry.management.servicecatalog.domain.PriceList;
import com.laundry.management.servicecatalog.domain.PriceListStatus;
import com.laundry.management.servicecatalog.domain.PriceRule;
import com.laundry.management.servicecatalog.domain.PriceRuleStatus;
import com.laundry.management.servicecatalog.domain.PricingAuditAction;
import com.laundry.management.servicecatalog.infrastructure.ItemTypeRepository;
import com.laundry.management.servicecatalog.infrastructure.LaundryServiceRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceListRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceRuleRepository;
import com.laundry.management.servicecatalog.infrastructure.PricingBranchLockRepository;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PriceListApplicationService {

    private static final Collection<PriceListStatus> PUBLISHED_STATUSES =
        List.of(PriceListStatus.SCHEDULED, PriceListStatus.ACTIVE, PriceListStatus.EXPIRED);

    private final PriceListRepository priceListRepository;
    private final PriceRuleRepository priceRuleRepository;
    private final LaundryServiceRepository serviceRepository;
    private final ItemTypeRepository itemTypeRepository;
    private final PricingBranchLockRepository branchLockRepository;
    private final CatalogAuthorizationService authorizationService;
    private final CatalogCodeGenerator codeGenerator;
    private final PriceRuleValidator ruleValidator;
    private final PricingAuditService auditService;
    private final CatalogMapper mapper;
    private final PricingDomainEventPublisher eventPublisher;

    public PriceListApplicationService(
        PriceListRepository priceListRepository,
        PriceRuleRepository priceRuleRepository,
        LaundryServiceRepository serviceRepository,
        ItemTypeRepository itemTypeRepository,
        PricingBranchLockRepository branchLockRepository,
        CatalogAuthorizationService authorizationService,
        CatalogCodeGenerator codeGenerator,
        PriceRuleValidator ruleValidator,
        PricingAuditService auditService,
        CatalogMapper mapper,
        PricingDomainEventPublisher eventPublisher
    ) {
        this.priceListRepository = priceListRepository;
        this.priceRuleRepository = priceRuleRepository;
        this.serviceRepository = serviceRepository;
        this.itemTypeRepository = itemTypeRepository;
        this.branchLockRepository = branchLockRepository;
        this.authorizationService = authorizationService;
        this.codeGenerator = codeGenerator;
        this.ruleValidator = ruleValidator;
        this.auditService = auditService;
        this.mapper = mapper;
        this.eventPublisher = eventPublisher;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).PRICE_LIST_READ)")
    @Transactional(readOnly = true)
    public CatalogDtos.PriceListPageResponse list(
        int page,
        int size,
        String search,
        Long branchId,
        PriceListStatus status
    ) {
        validatePage(page, size);
        if (branchId != null) authorizationService.requireBranchScope(branchId);
        var result = priceListRepository.search(
            authorizationService.branchScope(), branchId, status, likePattern(search),
            PageRequest.of(page, size, Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id")))
        );
        List<Long> ids = result.stream().map(PriceList::getId).toList();
        Map<Long, Long> counts = new HashMap<>();
        if (!ids.isEmpty()) {
            priceRuleRepository.countByPriceListIds(ids)
                .forEach(count -> counts.put(count.getPriceListId(), count.getRuleCount()));
        }
        return new CatalogDtos.PriceListPageResponse(
            result.stream().map(item -> mapper.priceList(item, counts.getOrDefault(item.getId(), 0L))).toList(),
            result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages()
        );
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).PRICE_LIST_READ)")
    @Transactional(readOnly = true)
    public CatalogDtos.PriceListResponse get(Long id) {
        PriceList list = scopedList(id);
        return mapper.priceList(list, priceRuleRepository.countByPriceListId(id));
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).PRICE_LIST_READ) and @permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).PRICE_RULE_READ)")
    @Transactional(readOnly = true)
    public CatalogDtos.PriceListDetailResponse detail(Long id) {
        PriceList list = scopedList(id);
        List<PriceRule> rules = priceRuleRepository.findByPriceListIdOrderByRulePriorityDescIdAsc(id);
        return new CatalogDtos.PriceListDetailResponse(
            mapper.priceList(list, rules.size()),
            rules.stream().map(mapper::rule).toList()
        );
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).PRICING_READ_HISTORY)")
    @Transactional(readOnly = true)
    public Long branchIdForRule(Long ruleId) {
        PriceRule rule = priceRuleRepository.findById(ruleId).orElseThrow(() -> ruleNotFound());
        Long branchId = rule.getPriceList().getBranch().getId();
        authorizationService.requireBranchScope(branchId);
        return branchId;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).PRICE_LIST_CREATE)")
    @Transactional
    public CatalogDtos.PriceListResponse create(CatalogDtos.PriceListRequest request) {
        validatePeriod(request.effectiveFrom(), request.effectiveTo());
        Branch branch = authorizationService.requireBranch(request.branchId());
        UserAccount actor = authorizationService.actor();
        PriceList list = new PriceList(
            codeGenerator.nextPriceListCode(), text(request.name()), text(request.description()), branch,
            currency(request.currency()), request.effectiveFrom(), request.effectiveTo(), actor
        );
        priceListRepository.saveAndFlush(list);
        auditService.record(
            "PRICE_LIST", list.getId(), PricingAuditAction.PRICE_LIST_CREATED, Map.of(),
            priceListSnapshot(list), null, branch, actor
        );
        return mapper.priceList(list, 0);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).PRICE_LIST_UPDATE_DRAFT)")
    @Transactional
    public CatalogDtos.PriceListResponse update(Long id, CatalogDtos.PriceListRequest request) {
        PriceList list = lockedScopedList(id);
        requireDraft(list);
        requireVersion(list, request.version());
        if (!list.getBranch().getId().equals(request.branchId())) {
            throw invalid("A draft price list cannot be moved to another branch.");
        }
        validatePeriod(request.effectiveFrom(), request.effectiveTo());
        UserAccount actor = authorizationService.actor();
        Map<String, Object> oldValue = priceListSnapshot(list);
        list.updateDraft(
            text(request.name()), text(request.description()), request.effectiveFrom(), request.effectiveTo(), actor
        );
        priceListRepository.flush();
        auditService.record(
            "PRICE_LIST", list.getId(), PricingAuditAction.PRICE_LIST_UPDATED,
            oldValue, priceListSnapshot(list),
            null, list.getBranch(), actor
        );
        return mapper.priceList(list, priceRuleRepository.countByPriceListId(id));
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).PRICE_LIST_DUPLICATE)")
    @Transactional
    public CatalogDtos.PriceListDetailResponse duplicate(
        Long id,
        CatalogDtos.DuplicatePriceListRequest request
    ) {
        PriceList source = lockedScopedList(id);
        validatePeriod(request.effectiveFrom(), request.effectiveTo());
        UserAccount actor = authorizationService.actor();
        PriceList target = new PriceList(
            codeGenerator.nextPriceListCode(), text(request.name()), source.getDescription(), source.getBranch(),
            source.getCurrency(), request.effectiveFrom(), request.effectiveTo(), actor
        );
        priceListRepository.saveAndFlush(target);
        List<PriceRule> copied = priceRuleRepository.findByPriceListIdOrderByRulePriorityDescIdAsc(source.getId())
            .stream().map(rule -> copyRule(rule, target, request.effectiveFrom(), request.effectiveTo(), actor)).toList();
        priceRuleRepository.saveAll(copied);
        priceRuleRepository.flush();
        auditService.record(
            "PRICE_LIST", target.getId(), PricingAuditAction.PRICE_LIST_DUPLICATED, Map.of(),
            duplicatedSnapshot(target, source.getId(), copied.size()), null, target.getBranch(), actor
        );
        return new CatalogDtos.PriceListDetailResponse(
            mapper.priceList(target, copied.size()), copied.stream().map(mapper::rule).toList()
        );
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).PRICE_RULE_CREATE)")
    @Transactional
    public CatalogDtos.PriceRuleResponse addRule(Long priceListId, CatalogDtos.PriceRuleRequest request) {
        PriceList list = lockedScopedList(priceListId);
        requireDraft(list);
        LaundryService service = activeService(request.serviceId());
        ItemType itemType = activeItemType(request.itemTypeId());
        List<PriceRule> existing = priceRuleRepository.findByPriceListIdOrderByRulePriorityDescIdAsc(priceListId);
        ruleValidator.validate(list, service, itemType, request, existing, null);
        UserAccount actor = authorizationService.actor();
        PriceRule rule = new PriceRule(list, service, itemType, actor);
        configure(rule, request, service, itemType, 1, actor);
        priceRuleRepository.saveAndFlush(rule);
        recordRuleAudit(list, rule, PricingAuditAction.PRICE_RULE_CREATED, Map.of(), scope(rule), actor);
        return mapper.rule(rule);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).PRICE_RULE_UPDATE_DRAFT)")
    @Transactional
    public CatalogDtos.PriceRuleResponse updateRule(
        Long priceListId,
        Long ruleId,
        CatalogDtos.PriceRuleRequest request
    ) {
        PriceList list = lockedScopedList(priceListId);
        requireDraft(list);
        PriceRule rule = priceRuleRepository.findByIdAndPriceListId(ruleId, priceListId)
            .orElseThrow(() -> ruleNotFound());
        requireRuleVersion(rule, request.rowVersion());
        LaundryService service = activeService(request.serviceId());
        ItemType itemType = activeItemType(request.itemTypeId());
        List<PriceRule> existing = priceRuleRepository.findByPriceListIdOrderByRulePriorityDescIdAsc(priceListId);
        ruleValidator.validate(list, service, itemType, request, existing, ruleId);
        UserAccount actor = authorizationService.actor();
        Map<String, Object> oldValue = scope(rule);
        configure(rule, request, service, itemType, rule.getVersionNumber(), actor);
        priceRuleRepository.flush();
        recordRuleAudit(list, rule, PricingAuditAction.PRICE_RULE_UPDATED, oldValue, scope(rule), actor);
        return mapper.rule(rule);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).PRICE_RULE_DELETE_DRAFT)")
    @Transactional
    public void deleteRule(Long priceListId, Long ruleId, long rowVersion) {
        PriceList list = lockedScopedList(priceListId);
        requireDraft(list);
        PriceRule rule = priceRuleRepository.findByIdAndPriceListId(ruleId, priceListId)
            .orElseThrow(() -> ruleNotFound());
        requireRuleVersion(rule, rowVersion);
        UserAccount actor = authorizationService.actor();
        Map<String, Object> oldValue = scope(rule);
        priceRuleRepository.delete(rule);
        priceRuleRepository.flush();
        recordRuleAudit(list, rule, PricingAuditAction.PRICE_RULE_DELETED, oldValue, Map.of(), actor);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).PRICE_LIST_PUBLISH)")
    @Transactional
    public CatalogDtos.PriceListDetailResponse publish(
        Long id,
        CatalogDtos.PriceListLifecycleRequest request
    ) {
        PriceList list = lockedScopedList(id);
        requireDraft(list);
        requireVersion(list, request.version());
        Branch branch = branchLockRepository.lockById(list.getBranch().getId())
            .orElseThrow(() -> authorizationService.inaccessible("Branch"));
        List<PriceRule> rules = priceRuleRepository.findByPriceListIdOrderByRulePriorityDescIdAsc(id);
        if (rules.isEmpty()) {
            throw invalid("A price list must contain at least one valid rule before publication.");
        }
        for (PriceRule rule : rules) {
            CatalogDtos.PriceRuleRequest validationRequest = requestFrom(rule);
            ruleValidator.validate(list, rule.getService(), rule.getItemType(), validationRequest, rules, rule.getId());
        }
        Instant now = Instant.now();
        List<PriceList> overlaps = priceListRepository.findOverlappingPublished(
            branch.getId(), list.getId(), PUBLISHED_STATUSES, list.getEffectiveFrom(), list.getEffectiveTo()
        );
        UserAccount actor = authorizationService.actor();
        for (PriceList existing : overlaps) {
            if (!existing.getEffectiveFrom().isBefore(list.getEffectiveFrom())) {
                throw new ApiException(
                    HttpStatus.CONFLICT, ErrorCode.PRICING_LIST_CONFLICT,
                    "Conflicting price list",
                    "Published price list " + existing.getId() + " overlaps the requested effective period."
                );
            }
            existing.closeAt(list.getEffectiveFrom(), now, actor);
            priceRuleRepository.findByPriceListIdOrderByRulePriorityDescIdAsc(existing.getId())
                .forEach(rule -> rule.closeAt(list.getEffectiveFrom(), now, actor));
            auditService.record(
                "PRICE_LIST", existing.getId(), PricingAuditAction.PRICE_RULE_SUPERSEDED,
                Map.of("effectiveTo", "open"), Map.of("effectiveTo", list.getEffectiveFrom().toString()),
                request.reason(), branch, actor
            );
        }
        rules.forEach(rule -> rule.publish(now, actor));
        list.publish(now, actor);
        priceListRepository.flush();
        priceRuleRepository.flush();
        PricingAuditAction action = list.getStatus() == PriceListStatus.SCHEDULED
            ? PricingAuditAction.PRICE_LIST_SCHEDULED : PricingAuditAction.PRICE_LIST_PUBLISHED;
        auditService.record(
            "PRICE_LIST", list.getId(), action, Map.of("status", "DRAFT"),
            Map.of("status", list.getStatus().name(), "ruleCount", rules.size()),
            request.reason(), branch, actor
        );
        eventPublisher.publish(new PriceListPublishedEvent(
            list.getId(), list.getName(), branch.getId(), list.getStatus(),
            list.getEffectiveFrom(), list.getEffectiveTo(), actor.getId()
        ));
        return new CatalogDtos.PriceListDetailResponse(
            mapper.priceList(list, rules.size()), rules.stream().map(mapper::rule).toList()
        );
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).PRICE_LIST_ARCHIVE)")
    @Transactional
    public CatalogDtos.PriceListResponse archive(
        Long id,
        CatalogDtos.PriceListLifecycleRequest request
    ) {
        PriceList list = lockedScopedList(id);
        requireVersion(list, request.version());
        if (list.getStatus() == PriceListStatus.ARCHIVED) return mapper.priceList(
            list, priceRuleRepository.countByPriceListId(id)
        );
        UserAccount actor = authorizationService.actor();
        PriceListStatus previous = list.getStatus();
        list.archive(Instant.now(), actor);
        priceRuleRepository.findByPriceListIdOrderByRulePriorityDescIdAsc(id)
            .forEach(rule -> rule.archive(actor));
        priceListRepository.flush();
        auditService.record(
            "PRICE_LIST", list.getId(), PricingAuditAction.PRICE_LIST_ARCHIVED,
            Map.of("status", previous.name()), Map.of("status", PriceListStatus.ARCHIVED.name()),
            request.reason(), list.getBranch(), actor
        );
        return mapper.priceList(list, priceRuleRepository.countByPriceListId(id));
    }

    private PriceRule copyRule(
        PriceRule source,
        PriceList target,
        Instant effectiveFrom,
        Instant effectiveTo,
        UserAccount actor
    ) {
        PriceRule copy = new PriceRule(target, source.getService(), source.getItemType(), actor);
        copy.configure(
            source.getService(), source.getItemType(), source.getPricingMethod(), source.getUnitType(),
            source.getSharingMode(), source.getPriorityLevel(), source.getBasePrice(), source.getUnitPrice(),
            source.getMinimumQuantity(), source.getMaximumQuantity(), source.getMinimumCharge(),
            source.getIncludedQuantity(), source.getExcessUnitPrice(), source.getTierCalculationMode(),
            source.getRulePriority(), effectiveFrom, effectiveTo, source.getVersionNumber() + 1,
            source.getTiers().stream().map(tier -> new PriceRule.PriceRuleTierValue(
                tier.getFromQuantity(), tier.getToQuantity(), tier.getUnitPrice(), tier.getSortOrder()
            )).toList(), actor
        );
        return copy;
    }

    private void configure(
        PriceRule rule,
        CatalogDtos.PriceRuleRequest request,
        LaundryService service,
        ItemType itemType,
        int versionNumber,
        UserAccount actor
    ) {
        rule.configure(
            service, itemType, request.pricingMethod(), request.unitType(), request.sharingMode(),
            request.priorityLevel(), request.basePrice(), request.unitPrice(), request.minimumQuantity(),
            request.maximumQuantity(), request.minimumCharge(), request.includedQuantity(),
            request.excessUnitPrice(), request.tierCalculationMode(), request.rulePriority(),
            request.effectiveFrom(), request.effectiveTo(), versionNumber,
            request.tiers() == null ? List.of() : request.tiers().stream()
                .map(tier -> new PriceRule.PriceRuleTierValue(
                    tier.fromQuantity(), tier.toQuantity(), tier.unitPrice(), tier.sortOrder()
                )).toList(),
            actor
        );
    }

    private CatalogDtos.PriceRuleRequest requestFrom(PriceRule rule) {
        return new CatalogDtos.PriceRuleRequest(
            rule.getService().getId(), rule.getItemType() == null ? null : rule.getItemType().getId(),
            rule.getPricingMethod(), rule.getUnitType(), rule.getSharingMode(), rule.getPriorityLevel(),
            rule.getBasePrice(), rule.getUnitPrice(), rule.getMinimumQuantity(), rule.getMaximumQuantity(),
            rule.getMinimumCharge(), rule.getIncludedQuantity(), rule.getExcessUnitPrice(),
            rule.getTierCalculationMode(), rule.getRulePriority(), rule.getEffectiveFrom(), rule.getEffectiveTo(),
            rule.getTiers().stream().map(tier -> new CatalogDtos.TierRequest(
                tier.getFromQuantity(), tier.getToQuantity(), tier.getUnitPrice(), tier.getSortOrder()
            )).toList(), rule.getRowVersion()
        );
    }

    private Map<String, Object> scope(PriceRule rule) {
        Map<String, Object> scope = new LinkedHashMap<>();
        scope.put("priceRuleId", rule.getId());
        scope.put("priceListId", rule.getPriceList().getId());
        scope.put("serviceId", rule.getService().getId());
        scope.put("serviceName", rule.getService().getNameVi());
        scope.put("itemTypeId", rule.getItemType() == null ? null : rule.getItemType().getId());
        scope.put("itemTypeName", rule.getItemType() == null ? null : rule.getItemType().getNameVi());
        scope.put("sharingMode", rule.getSharingMode().name());
        scope.put("pricingMethod", rule.getPricingMethod().name());
        scope.put("unitType", rule.getUnitType().name());
        scope.put("priorityLevel", rule.getPriorityLevel());
        scope.put("basePrice", rule.getBasePrice());
        scope.put("unitPrice", rule.getUnitPrice());
        scope.put("minimumQuantity", rule.getMinimumQuantity());
        scope.put("maximumQuantity", rule.getMaximumQuantity());
        scope.put("minimumCharge", rule.getMinimumCharge());
        scope.put("includedQuantity", rule.getIncludedQuantity());
        scope.put("excessUnitPrice", rule.getExcessUnitPrice());
        scope.put("tierCalculationMode",
            rule.getTierCalculationMode() == null ? null : rule.getTierCalculationMode().name());
        scope.put("effectiveFrom", rule.getEffectiveFrom());
        scope.put("effectiveTo", rule.getEffectiveTo());
        scope.put("rulePriority", rule.getRulePriority());
        scope.put("versionNumber", rule.getVersionNumber());
        scope.put("tiers", rule.getTiers().stream().map(tier -> {
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("fromQuantity", tier.getFromQuantity());
            value.put("toQuantity", tier.getToQuantity());
            value.put("unitPrice", tier.getUnitPrice());
            value.put("sortOrder", tier.getSortOrder());
            return value;
        }).toList());
        return scope;
    }

    private Map<String, Object> priceListSnapshot(PriceList list) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("code", list.getCode());
        value.put("name", list.getName());
        value.put("description", list.getDescription());
        value.put("branchId", list.getBranch().getId());
        value.put("branchName", list.getBranch().getName());
        value.put("currency", list.getCurrency());
        value.put("status", list.getStatus().name());
        value.put("effectiveFrom", list.getEffectiveFrom());
        value.put("effectiveTo", list.getEffectiveTo());
        return value;
    }

    private Map<String, Object> duplicatedSnapshot(
        PriceList target,
        Long sourcePriceListId,
        int ruleCount
    ) {
        Map<String, Object> value = priceListSnapshot(target);
        value.put("sourcePriceListId", sourcePriceListId);
        value.put("ruleCount", ruleCount);
        return value;
    }

    private void recordRuleAudit(
        PriceList list,
        PriceRule rule,
        PricingAuditAction action,
        Map<String, Object> oldValue,
        Map<String, Object> newValue,
        UserAccount actor
    ) {
        auditService.record(
            "PRICE_RULE", rule.getId(), action, oldValue, newValue, null, list.getBranch(), actor
        );
        auditService.record(
            "PRICE_LIST", list.getId(), action, oldValue, newValue, null, list.getBranch(), actor
        );
    }

    private PriceList scopedList(Long id) {
        PriceList list = priceListRepository.findById(id)
            .orElseThrow(() -> authorizationService.inaccessible("Price list"));
        authorizationService.requireBranchScope(list.getBranch().getId());
        return list;
    }

    private PriceList lockedScopedList(Long id) {
        PriceList list = priceListRepository.lockById(id)
            .orElseThrow(() -> authorizationService.inaccessible("Price list"));
        authorizationService.requireBranchScope(list.getBranch().getId());
        return list;
    }

    private LaundryService activeService(Long id) {
        return serviceRepository.findByIdAndStatus(id, CatalogStatus.ACTIVE)
            .orElseThrow(() -> new ApiException(
                HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.SERVICE_NOT_FOUND,
                "Service unavailable", "The selected service does not exist or is not active."
            ));
    }

    private ItemType activeItemType(Long id) {
        if (id == null) return null;
        return itemTypeRepository.findByIdAndStatus(id, CatalogStatus.ACTIVE)
            .orElseThrow(() -> new ApiException(
                HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.ITEM_TYPE_NOT_FOUND,
                "Item type unavailable", "The selected item type does not exist or is not active."
            ));
    }

    private void requireDraft(PriceList list) {
        if (list.getStatus() != PriceListStatus.DRAFT) {
            throw invalid("Published, scheduled, expired, or archived price lists cannot be edited in place.");
        }
    }

    private void requireVersion(PriceList list, Long requested) {
        if (requested == null || list.getVersion() != requested) {
            throw versionConflict();
        }
    }

    private void requireRuleVersion(PriceRule rule, Long requested) {
        if (requested == null || rule.getRowVersion() != requested) {
            throw versionConflict();
        }
    }

    private void validatePeriod(Instant from, Instant to) {
        if (to != null && !to.isAfter(from)) {
            throw invalid("effectiveTo must be later than effectiveFrom.");
        }
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                size > 100 ? ErrorCode.PAGE_SIZE_EXCEEDED : ErrorCode.VALIDATION_ERROR,
                "Invalid pagination", "Page must not be negative and size must be between 1 and 100."
            );
        }
    }

    private String currency(String value) {
        String normalized = text(value);
        return normalized == null ? "VND" : normalized.toUpperCase(Locale.ROOT);
    }

    private String text(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String likePattern(String value) {
        String normalized = text(value);
        if (normalized == null) return null;
        return "%" + normalized.toLowerCase(Locale.ROOT)
            .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    private ApiException versionConflict() {
        return new ApiException(
            HttpStatus.CONFLICT, ErrorCode.PRICING_VERSION_CONFLICT, "Version conflict",
            "This pricing record was updated by another user. Reload the latest data before saving."
        );
    }

    private ApiException ruleNotFound() {
        return new ApiException(
            HttpStatus.NOT_FOUND, ErrorCode.PRICE_RULE_NOT_FOUND,
            "Pricing rule not found", "The requested pricing rule does not exist in this price list."
        );
    }

    private ApiException invalid(String detail) {
        return new ApiException(
            HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.PRICING_VALIDATION_ERROR,
            "Invalid price list", detail
        );
    }
}
