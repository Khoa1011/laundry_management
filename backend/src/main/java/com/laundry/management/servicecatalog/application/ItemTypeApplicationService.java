package com.laundry.management.servicecatalog.application;

import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.servicecatalog.api.CatalogDtos;
import com.laundry.management.servicecatalog.domain.CatalogStatus;
import com.laundry.management.servicecatalog.domain.ItemType;
import com.laundry.management.servicecatalog.domain.PricingAuditAction;
import com.laundry.management.servicecatalog.infrastructure.ItemTypeRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceRuleRepository;
import com.laundry.management.servicecatalog.infrastructure.ServiceItemEligibilityRepository;
import com.laundry.management.servicecatalog.domain.PriceListStatus;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ItemTypeApplicationService {

    private final ItemTypeRepository repository;
    private final CatalogCodeGenerator codeGenerator;
    private final CatalogAuthorizationService authorizationService;
    private final PricingAuditService auditService;
    private final CatalogMapper mapper;
    private final PriceRuleRepository priceRuleRepository;
    private final ServiceItemEligibilityRepository eligibilityRepository;

    public ItemTypeApplicationService(
        ItemTypeRepository repository,
        CatalogCodeGenerator codeGenerator,
        CatalogAuthorizationService authorizationService,
        PricingAuditService auditService,
        CatalogMapper mapper,
        PriceRuleRepository priceRuleRepository,
        ServiceItemEligibilityRepository eligibilityRepository
    ) {
        this.repository = repository;
        this.codeGenerator = codeGenerator;
        this.authorizationService = authorizationService;
        this.auditService = auditService;
        this.mapper = mapper;
        this.priceRuleRepository = priceRuleRepository;
        this.eligibilityRepository = eligibilityRepository;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ITEM_TYPE_READ)")
    @Transactional(readOnly = true)
    public List<CatalogDtos.ItemTypeResponse> tree() {
        List<ItemType> items = repository.findAllByOrderBySortOrderAscNameViAscIdAsc();
        List<Long> itemIds = items.stream().map(ItemType::getId).toList();
        Map<Long, Long> serviceCounts = new java.util.HashMap<>();
        Map<Long, Long> ruleCounts = new java.util.HashMap<>();
        if (!itemIds.isEmpty()) {
            eligibilityRepository.countByItemTypeIds(itemIds).forEach(value ->
                serviceCounts.put(value.getItemTypeId(), value.getServiceCount()));
            priceRuleRepository.countByItemTypeIds(itemIds).forEach(value ->
                ruleCounts.put(value.getItemTypeId(), value.getRuleCount()));
        }
        Map<Long, List<ItemType>> byParent = new LinkedHashMap<>();
        for (ItemType item : items) {
            Long parentId = item.getParent() == null ? null : item.getParent().getId();
            byParent.computeIfAbsent(parentId, ignored -> new ArrayList<>()).add(item);
        }
        return build(null, byParent, serviceCounts, ruleCounts);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ITEM_TYPE_READ)")
    @Transactional(readOnly = true)
    public CatalogDtos.ItemTypeResponse get(Long id) {
        ItemType item = require(id);
        return mapper.itemType(item, List.of(), eligibilityRepository.countByItemTypeId(id),
            priceRuleRepository.countByItemTypeId(id));
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ITEM_TYPE_CREATE)")
    @Transactional
    public CatalogDtos.ItemTypeResponse create(CatalogDtos.ItemTypeRequest request) {
        ItemType parent = parent(request.parentId());
        UserAccount actor = authorizationService.actor();
        ItemType item = new ItemType(
            codeGenerator.nextItemTypeCode(), parent, text(request.nameVi()), text(request.nameEn()),
            text(request.descriptionVi()), text(request.descriptionEn()), request.defaultUnitType(),
            request.requiresSeparateWash(), text(request.defaultColorRisk()), text(request.defaultHygieneLevel()),
            request.sortOrder(), actor
        );
        repository.saveAndFlush(item);
        auditService.record(
            "ITEM_TYPE", item.getId(), PricingAuditAction.ITEM_TYPE_CREATED, Map.of(),
            snapshot(item),
            null, null, actor
        );
        return mapper.itemType(item, List.of());
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ITEM_TYPE_UPDATE)")
    @Transactional
    public CatalogDtos.ItemTypeResponse update(Long id, CatalogDtos.ItemTypeRequest request) {
        ItemType item = require(id);
        requireVersion(item, request.version());
        if (item.getStatus() == CatalogStatus.ARCHIVED) {
            throw policy("Archived item types cannot be edited.");
        }
        ItemType parent = parent(request.parentId());
        validateParent(item, parent);
        Long previousParent = item.getParent() == null ? null : item.getParent().getId();
        Map<String, Object> oldValue = snapshot(item);
        UserAccount actor = authorizationService.actor();
        item.update(
            parent, text(request.nameVi()), text(request.nameEn()), text(request.descriptionVi()),
            text(request.descriptionEn()), request.defaultUnitType(), request.requiresSeparateWash(),
            text(request.defaultColorRisk()), text(request.defaultHygieneLevel()), request.sortOrder(), actor
        );
        repository.flush();
        Long nextParent = parent == null ? null : parent.getId();
        auditService.record(
            "ITEM_TYPE", item.getId(),
            java.util.Objects.equals(previousParent, nextParent)
                ? PricingAuditAction.ITEM_TYPE_UPDATED : PricingAuditAction.ITEM_TYPE_MOVED,
            oldValue,
            snapshot(item),
            null, null, actor
        );
        return mapper.itemType(item, List.of());
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ITEM_TYPE_ARCHIVE)")
    @Transactional
    public CatalogDtos.ItemTypeResponse changeStatus(Long id, CatalogDtos.CatalogStatusRequest request) {
        ItemType item = repository.lockById(id).orElseThrow(() ->
            new ApiException(HttpStatus.NOT_FOUND, ErrorCode.ITEM_TYPE_NOT_FOUND,
                "Item type not found", "The requested item type does not exist."));
        requireVersion(item, request.version());
        CatalogStatus previous = item.getStatus();
        if (previous != request.status()) {
            if (previous == CatalogStatus.ARCHIVED) {
                throw policy("Archived item types cannot be reactivated.");
            }
            if (request.status() == CatalogStatus.ARCHIVED && repository.existsByParentId(id)) {
                throw policy("Move or archive child item types before archiving this parent.");
            }
            if (request.status() == CatalogStatus.ARCHIVED
                && priceRuleRepository.countPublishedReferencesByItemTypeId(id,
                    List.of(PriceListStatus.ACTIVE, PriceListStatus.SCHEDULED), java.time.Instant.now()) > 0) {
                throw policy("This item type is used by an active or scheduled price list and cannot be archived.");
            }
            UserAccount actor = authorizationService.actor();
            item.changeStatus(request.status(), actor);
            repository.flush();
            auditService.record(
                "ITEM_TYPE", item.getId(), PricingAuditAction.ITEM_TYPE_STATUS_CHANGED,
                Map.of("status", previous.name()), Map.of("status", request.status().name()),
                null, null, actor
            );
        }
        return mapper.itemType(item, List.of());
    }

    private List<CatalogDtos.ItemTypeResponse> build(
        Long parentId,
        Map<Long, List<ItemType>> byParent,
        Map<Long, Long> serviceCounts,
        Map<Long, Long> ruleCounts
    ) {
        return byParent.getOrDefault(parentId, List.of()).stream()
            .map(item -> mapper.itemType(item, build(item.getId(), byParent, serviceCounts, ruleCounts),
                serviceCounts.getOrDefault(item.getId(), 0L), ruleCounts.getOrDefault(item.getId(), 0L)))
            .toList();
    }

    private ItemType parent(Long id) {
        if (id == null) return null;
        ItemType parent = require(id);
        if (parent.getStatus() == CatalogStatus.ARCHIVED) {
            throw policy("Archived item types cannot be selected as a parent.");
        }
        return parent;
    }

    private Map<String, Object> snapshot(ItemType item) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("code", item.getCode());
        value.put("parentId", item.getParent() == null ? null : item.getParent().getId());
        value.put("nameVi", item.getNameVi());
        value.put("descriptionVi", item.getDescriptionVi());
        value.put("defaultUnitType", item.getDefaultUnitType() == null ? null : item.getDefaultUnitType().name());
        value.put("requiresSeparateWash", item.isRequiresSeparateWash());
        value.put("defaultColorRisk", item.getDefaultColorRisk());
        value.put("defaultHygieneLevel", item.getDefaultHygieneLevel());
        value.put("sortOrder", item.getSortOrder());
        value.put("status", item.getStatus().name());
        return value;
    }

    private void validateParent(ItemType item, ItemType parent) {
        ItemType current = parent;
        while (current != null) {
            if (current.getId().equals(item.getId())) {
                throw new ApiException(
                    HttpStatus.CONFLICT, ErrorCode.ITEM_TYPE_CYCLE,
                    "Circular item hierarchy", "An item type cannot be its own parent or descendant."
                );
            }
            current = current.getParent();
        }
    }

    private ItemType require(Long id) {
        return repository.findById(id).orElseThrow(() ->
            new ApiException(HttpStatus.NOT_FOUND, ErrorCode.ITEM_TYPE_NOT_FOUND,
                "Item type not found", "The requested item type does not exist."));
    }

    private void requireVersion(ItemType item, Long requested) {
        if (requested == null || item.getVersion() != requested) {
            throw new ApiException(
                HttpStatus.CONFLICT, ErrorCode.PRICING_VERSION_CONFLICT, "Version conflict",
                "This item type was updated by another user. Reload the latest data before saving."
            );
        }
    }

    private String text(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private ApiException policy(String detail) {
        return new ApiException(
            HttpStatus.BAD_REQUEST, ErrorCode.PRICING_VALIDATION_ERROR,
            "Invalid item-type configuration", detail
        );
    }
}
