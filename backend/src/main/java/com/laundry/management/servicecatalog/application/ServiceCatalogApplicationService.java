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

    public ServiceCatalogApplicationService(
        LaundryServiceRepository repository,
        CatalogCodeGenerator codeGenerator,
        CatalogAuthorizationService authorizationService,
        PricingAuditService auditService,
        CatalogMapper mapper
    ) {
        this.repository = repository;
        this.codeGenerator = codeGenerator;
        this.authorizationService = authorizationService;
        this.auditService = auditService;
        this.mapper = mapper;
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
        return new CatalogDtos.ServiceListResponse(
            result.stream().map(mapper::service).toList(),
            result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages()
        );
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).SERVICE_READ)")
    @Transactional(readOnly = true)
    public CatalogDtos.ServiceResponse get(Long id) {
        return mapper.service(require(id));
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
        LaundryService service = require(id);
        requireVersion(service, request.version());
        CatalogStatus previous = service.getStatus();
        if (previous != request.status()) {
            if (previous == CatalogStatus.ARCHIVED) {
                throw policy("Archived services cannot be reactivated.");
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
