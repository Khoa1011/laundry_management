package com.laundry.management.servicecatalog.application;

import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.servicecatalog.api.CatalogDtos;
import com.laundry.management.servicecatalog.domain.CatalogStatus;
import com.laundry.management.servicecatalog.domain.LaundryService;
import com.laundry.management.servicecatalog.domain.PricingAuditAction;
import com.laundry.management.servicecatalog.domain.ProcessingType;
import com.laundry.management.servicecatalog.domain.UnitType;
import com.laundry.management.servicecatalog.infrastructure.LaundryServiceRepository;
import com.laundry.management.servicecatalog.infrastructure.ItemTypeRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceRuleRepository;
import com.laundry.management.servicecatalog.infrastructure.ServiceItemEligibilityRepository;
import com.laundry.management.servicecatalog.domain.ServiceItemEligibility;
import com.laundry.management.servicecatalog.domain.PriceListStatus;
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
public class ServiceCatalogApplicationService {

    private final LaundryServiceRepository repository;
    private final CatalogCodeGenerator codeGenerator;
    private final CatalogAuthorizationService authorizationService;
    private final PricingAuditService auditService;
    private final CatalogMapper mapper;
    private final ItemTypeRepository itemTypeRepository;
    private final PriceRuleRepository priceRuleRepository;
    private final ServiceItemEligibilityRepository eligibilityRepository;

    public ServiceCatalogApplicationService(
        LaundryServiceRepository repository,
        CatalogCodeGenerator codeGenerator,
        CatalogAuthorizationService authorizationService,
        PricingAuditService auditService,
        CatalogMapper mapper,
        ItemTypeRepository itemTypeRepository,
        PriceRuleRepository priceRuleRepository,
        ServiceItemEligibilityRepository eligibilityRepository
    ) {
        this.repository = repository;
        this.codeGenerator = codeGenerator;
        this.authorizationService = authorizationService;
        this.auditService = auditService;
        this.mapper = mapper;
        this.itemTypeRepository = itemTypeRepository;
        this.priceRuleRepository = priceRuleRepository;
        this.eligibilityRepository = eligibilityRepository;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).SERVICE_READ)")
    @Transactional(readOnly = true)
    public CatalogDtos.ServiceListResponse list(
        int page,
        int size,
        String search,
        CatalogStatus status,
        ProcessingType processingType,
        UnitType unitType
    ) {
        validatePage(page, size);
        String pattern = likePattern(search);
        var result = repository.search(
            pattern,
            status,
            processingType,
            unitType,
            PageRequest.of(page, size, Sort.by(Sort.Order.asc("nameVi"), Sort.Order.asc("id")))
        );
        List<Long> ids = result.stream().map(LaundryService::getId).toList();
        Map<Long, Long> eligibilityCounts = new java.util.HashMap<>();
        Map<Long, Long> ruleCounts = new java.util.HashMap<>();
        if (!ids.isEmpty()) {
            eligibilityRepository.countByServiceIds(ids).forEach(value ->
                eligibilityCounts.put(value.getServiceId(), value.getItemCount()));
            priceRuleRepository.countByServiceIds(ids).forEach(value ->
                ruleCounts.put(value.getServiceId(), value.getRuleCount()));
        }
        return new CatalogDtos.ServiceListResponse(
            result.stream().map(item -> mapper.service(item,
                eligibilityCounts.getOrDefault(item.getId(), 0L),
                ruleCounts.getOrDefault(item.getId(), 0L))).toList(),
            result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages()
        );
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).SERVICE_READ)")
    @Transactional(readOnly = true)
    public CatalogDtos.ServiceResponse get(Long id) {
        LaundryService service = require(id);
        return mapper.service(service, eligibilityRepository.countByServiceId(id),
            priceRuleRepository.countByServiceId(id));
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).SERVICE_READ) and @permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ITEM_TYPE_READ)")
    @Transactional(readOnly = true)
    public CatalogDtos.ServiceEligibilityResponse eligibility(Long id) {
        LaundryService service = require(id);
        return new CatalogDtos.ServiceEligibilityResponse(
            id, service.getVersion(), eligibilityRepository.findByServiceIdOrderByItemTypeNameViAscItemTypeIdAsc(id)
                .stream().map(value -> new CatalogDtos.ItemTypeOptionResponse(
                    value.getItemType().getId(), value.getItemType().getCode(),
                    value.getItemType().getNameVi(), value.getItemType().getNameEn()
                )).toList()
        );
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).SERVICE_UPDATE) and @permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ITEM_TYPE_READ)")
    @Transactional
    public CatalogDtos.ServiceEligibilityResponse updateEligibility(
        Long id,
        CatalogDtos.EligibilityUpdateRequest request
    ) {
        LaundryService service = repository.lockById(id).orElseThrow(() ->
            new ApiException(HttpStatus.NOT_FOUND, ErrorCode.SERVICE_NOT_FOUND,
                "Service not found", "The requested service does not exist."));
        requireVersion(service, request.serviceVersion());
        if (service.getStatus() == CatalogStatus.ARCHIVED) throw policy("Archived services cannot be edited.");
        List<Long> requestedIds = request.itemTypeIds().stream().distinct().toList();
        List<com.laundry.management.servicecatalog.domain.ItemType> items = itemTypeRepository.findAllById(requestedIds);
        if (items.size() != requestedIds.size() || items.stream().anyMatch(item -> item.getStatus() != CatalogStatus.ACTIVE)) {
            throw policy("Only active, existing item types can be assigned to a service.");
        }
        UserAccount actor = authorizationService.actor();
        List<Long> oldIds = eligibilityRepository.findByServiceIdOrderByItemTypeNameViAscItemTypeIdAsc(id)
            .stream().map(value -> value.getItemType().getId()).toList();
        List<Long> removedIds = oldIds.stream().filter(itemId -> !requestedIds.contains(itemId)).toList();
        var protectedStatuses = List.of(PriceListStatus.ACTIVE, PriceListStatus.SCHEDULED);
        java.time.Instant now = java.time.Instant.now();
        if (requestedIds.isEmpty()
            && priceRuleRepository.countPublishedReferencesByServiceId(id, protectedStatuses, now) > 0) {
            throw policy("At least one eligible item type is required while an active or scheduled price list uses this service.");
        }
        if (removedIds.stream().anyMatch(itemId ->
            priceRuleRepository.countPublishedReferencesByServiceIdAndItemTypeId(
                id, itemId, protectedStatuses, now) > 0)) {
            throw policy("An eligible item type used by an active or scheduled price list cannot be removed.");
        }
        eligibilityRepository.deleteByServiceId(id);
        eligibilityRepository.flush();
        eligibilityRepository.saveAll(items.stream().map(item ->
            new ServiceItemEligibility(service, item, actor)).toList());
        service.touch(actor);
        repository.flush();
        auditService.record("SERVICE", id, PricingAuditAction.SERVICE_ELIGIBILITY_UPDATED,
            Map.of("itemTypeIds", oldIds), Map.of("itemTypeIds", requestedIds), null, null, actor);
        return eligibility(id);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).SERVICE_CREATE)")
    @Transactional
    public CatalogDtos.ServiceResponse create(CatalogDtos.ServiceRequest request) {
        UserAccount actor = authorizationService.actor();
        LaundryService service = new LaundryService(
            codeGenerator.nextServiceCode(), text(request.nameVi()), text(request.nameEn()),
            text(request.descriptionVi()), text(request.descriptionEn()), request.processingType(),
            request.defaultUnitType(), request.sharingAllowed(), request.estimatedMinutes(),
            request.minimumQuantity(), actor
        );
        validate(service);
        repository.saveAndFlush(service);
        auditService.record(
            "SERVICE", service.getId(), PricingAuditAction.SERVICE_CREATED, Map.of(),
            snapshot(service),
            null, null, actor
        );
        return mapper.service(service);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).SERVICE_UPDATE)")
    @Transactional
    public CatalogDtos.ServiceResponse update(Long id, CatalogDtos.ServiceRequest request) {
        LaundryService service = require(id);
        requireVersion(service, request.version());
        if (service.getStatus() == CatalogStatus.ARCHIVED) {
            throw policy("Archived services cannot be edited.");
        }
        UserAccount actor = authorizationService.actor();
        Map<String, Object> oldValue = snapshot(service);
        service.update(
            text(request.nameVi()), text(request.nameEn()), text(request.descriptionVi()),
            text(request.descriptionEn()), request.processingType(), request.defaultUnitType(),
            request.sharingAllowed(), request.estimatedMinutes(), request.minimumQuantity(), actor
        );
        validate(service);
        repository.flush();
        auditService.record(
            "SERVICE", service.getId(), PricingAuditAction.SERVICE_UPDATED, oldValue,
            snapshot(service),
            null, null, actor
        );
        return mapper.service(service);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).SERVICE_ARCHIVE)")
    @Transactional
    public CatalogDtos.ServiceResponse changeStatus(Long id, CatalogDtos.CatalogStatusRequest request) {
        LaundryService service = repository.lockById(id).orElseThrow(() ->
            new ApiException(HttpStatus.NOT_FOUND, ErrorCode.SERVICE_NOT_FOUND,
                "Service not found", "The requested service does not exist."));
        requireVersion(service, request.version());
        CatalogStatus previous = service.getStatus();
        if (previous != request.status()) {
            if (previous == CatalogStatus.ARCHIVED) {
                throw policy("Archived services cannot be reactivated.");
            }
            if (request.status() == CatalogStatus.ARCHIVED
                && priceRuleRepository.countPublishedReferencesByServiceId(id,
                    List.of(PriceListStatus.ACTIVE, PriceListStatus.SCHEDULED), java.time.Instant.now()) > 0) {
                throw policy("This service is used by an active or scheduled price list and cannot be archived.");
            }
            UserAccount actor = authorizationService.actor();
            service.changeStatus(request.status(), actor);
            repository.flush();
            auditService.record(
                "SERVICE", service.getId(), PricingAuditAction.SERVICE_STATUS_CHANGED,
                Map.of("status", previous.name()), Map.of("status", request.status().name()),
                null, null, actor
            );
        }
        return mapper.service(service);
    }

    private LaundryService require(Long id) {
        return repository.findById(id).orElseThrow(() ->
            new ApiException(HttpStatus.NOT_FOUND, ErrorCode.SERVICE_NOT_FOUND,
                "Service not found", "The requested service does not exist."));
    }

    private Map<String, Object> snapshot(LaundryService service) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("code", service.getCode());
        value.put("nameVi", service.getNameVi());
        value.put("descriptionVi", service.getDescriptionVi());
        value.put("processingType", service.getProcessingType().name());
        value.put("defaultUnitType", service.getDefaultUnitType().name());
        value.put("sharingAllowed", service.isSharingAllowed());
        value.put("estimatedMinutes", service.getEstimatedMinutes());
        value.put("minimumQuantity", service.getMinimumQuantity());
        value.put("status", service.getStatus().name());
        return value;
    }

    private void validate(LaundryService service) {
        if (service.getMinimumQuantity() != null
            && (service.getDefaultUnitType() == UnitType.FIXED || service.getDefaultUnitType() == UnitType.LOAD)) {
            throw policy("A fixed or load service cannot define a default minimum quantity.");
        }
        if (service.getProcessingType() == ProcessingType.DELIVERY
            && service.getDefaultUnitType() != UnitType.FIXED
            && service.getDefaultUnitType() != UnitType.ITEM) {
            throw policy("Delivery services must use FIXED or ITEM as the default unit.");
        }
    }

    private void requireVersion(LaundryService service, Long requested) {
        if (requested == null || service.getVersion() != requested) {
            throw new ApiException(
                HttpStatus.CONFLICT, ErrorCode.PRICING_VERSION_CONFLICT, "Version conflict",
                "This service was updated by another user. Reload the latest data before saving."
            );
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

    private String likePattern(String value) {
        String normalized = text(value);
        if (normalized == null) return null;
        return "%" + normalized.toLowerCase(Locale.ROOT)
            .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    private String text(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private ApiException policy(String detail) {
        return new ApiException(
            HttpStatus.BAD_REQUEST, ErrorCode.PRICING_VALIDATION_ERROR,
            "Invalid service configuration", detail
        );
    }
}
