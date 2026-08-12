package com.laundry.management.servicecatalog.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.servicecatalog.api.CatalogDtos;
import com.laundry.management.servicecatalog.domain.PricingAuditAction;
import com.laundry.management.servicecatalog.domain.PricingAuditLog;
import com.laundry.management.servicecatalog.infrastructure.PricingAuditRepository;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PricingAuditService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() { };
    private final PricingAuditRepository repository;
    private final CatalogAuthorizationService authorizationService;
    private final ObjectMapper objectMapper;

    public PricingAuditService(
        PricingAuditRepository repository,
        CatalogAuthorizationService authorizationService,
        ObjectMapper objectMapper
    ) {
        this.repository = repository;
        this.authorizationService = authorizationService;
        this.objectMapper = objectMapper;
    }

    public void record(
        String entityType,
        Long entityId,
        PricingAuditAction action,
        Map<String, Object> oldValue,
        Map<String, Object> newValue,
        String reason,
        Branch branch,
        UserAccount actor
    ) {
        repository.save(new PricingAuditLog(
            entityType, entityId, action, serialize(oldValue), serialize(newValue), reason, branch, actor
        ));
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).PRICING_READ_HISTORY)")
    @Transactional(readOnly = true)
    public CatalogDtos.AuditPageResponse list(
        String entityType,
        Long entityId,
        Long branchId,
        int page,
        int size
    ) {
        validatePage(page, size);
        if (branchId != null) {
            authorizationService.requireBranchScope(branchId);
        }
        var result = repository.findByEntityTypeAndEntityId(
            entityType,
            entityId,
            PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")))
        );
        if (branchId != null && result.stream().anyMatch(log ->
            log.getBranch() != null && !branchId.equals(log.getBranch().getId()))) {
            throw authorizationService.inaccessible("Pricing history");
        }
        return new CatalogDtos.AuditPageResponse(
            result.stream().map(this::map).toList(),
            result.getNumber(),
            result.getSize(),
            result.getTotalElements(),
            result.getTotalPages()
        );
    }

    private CatalogDtos.AuditResponse map(PricingAuditLog log) {
        Branch branch = log.getBranch();
        return new CatalogDtos.AuditResponse(
            log.getId(), log.getEntityType(), log.getEntityId(), log.getAction().name(),
            parse(log.getOldValue()), parse(log.getNewValue()), log.getReason(),
            branch == null ? null : new CatalogDtos.BranchResponse(branch.getId(), branch.getCode(), branch.getName()),
            new CatalogDtos.ActorResponse(log.getActor().getId(), log.getActor().getDisplayName()),
            log.getCreatedAt()
        );
    }

    private String serialize(Map<String, Object> value) {
        if (value == null || value.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize safe pricing audit metadata", exception);
        }
    }

    private Map<String, Object> parse(String value) {
        if (value == null || value.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(value, MAP_TYPE);
        } catch (JsonProcessingException exception) {
            return Map.of("fields", "unavailable");
        }
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                size > 100 ? ErrorCode.PAGE_SIZE_EXCEEDED : ErrorCode.VALIDATION_ERROR,
                "Invalid pagination",
                "Page must not be negative and size must be between 1 and 100."
            );
        }
    }
}
