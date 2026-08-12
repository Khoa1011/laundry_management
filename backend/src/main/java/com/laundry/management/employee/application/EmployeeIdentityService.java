package com.laundry.management.employee.application;

import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.employee.api.EmployeeSensitiveDtos;
import com.laundry.management.employee.domain.*;
import com.laundry.management.employee.infrastructure.EmployeeIdentityRepository;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmployeeIdentityService {
    private final EmployeeIdentityRepository repository;
    private final EmployeeSensitiveAccessService access;
    private final EmployeeAuthorizationService authorizationService;
    private final EmployeeIdentityCrypto crypto;
    private final EmployeeAuditService auditService;

    public EmployeeIdentityService(EmployeeIdentityRepository repository,
                                   EmployeeSensitiveAccessService access,
                                   EmployeeAuthorizationService authorizationService,
                                   EmployeeIdentityCrypto crypto,
                                   EmployeeAuditService auditService) {
        this.repository = repository;
        this.access = access;
        this.authorizationService = authorizationService;
        this.crypto = crypto;
        this.auditService = auditService;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_IDENTITY_READ) or @permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_IDENTITY_MASKED_READ)")
    @Transactional
    public EmployeeSensitiveDtos.IdentityResponse get(Long employeeId, EmployeeIdentityType type, boolean reveal) {
        Employee employee = access.employee(employeeId);
        EmployeeIdentity identity = repository.findByEmployeeIdAndIdentityType(employeeId, type)
            .orElseThrow(this::notFound);
        boolean full = reveal && authorizationService.hasPermission(PermissionCodes.EMPLOYEE_IDENTITY_READ);
        if (reveal && !full) {
            throw authorizationService.forbidden("You do not have permission to reveal the full identity number.");
        }
        if (full) {
            auditService.record(employee, EmployeeAuditAction.IDENTITY_VIEWED, Map.of(),
                Map.of("identityId", identity.getId(), "identityType", type.name()), null, null, access.actor());
        }
        return map(identity, full);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_IDENTITY_UPDATE)")
    @Transactional
    public void upsert(Long employeeId, EmployeeSensitiveDtos.IdentityRequest request) {
        Employee employee = access.employeeForUpdate(employeeId);
        UserAccount actor = access.actor();
        String normalized = normalize(request.identityType(), request.number());
        String hash = crypto.lookupHash(normalized);
        EmployeeIdentity identity = repository.findForUpdate(employeeId, request.identityType()).orElse(null);
        if (identity != null && (request.version() == null || request.version() != identity.getVersion())) {
            throw versionConflict();
        }
        if (repository.existsByNumberHashAndIdNot(hash, identity == null ? -1L : identity.getId())) {
            throw duplicate();
        }
        String encrypted = crypto.encrypt(normalized);
        String last4 = normalized.substring(normalized.length() - 4);
        validateDates(request);
        if (identity == null) {
            identity = new EmployeeIdentity(employee, request.identityType(), encrypted, hash, last4,
                request.issuedDate(), clean(request.issuedPlace()), request.expiresOn(), actor);
        } else {
            identity.update(encrypted, hash, last4, request.issuedDate(), clean(request.issuedPlace()),
                request.expiresOn(), actor);
        }
        try {
            repository.saveAndFlush(identity);
        } catch (DataIntegrityViolationException exception) {
            throw duplicate();
        }
        auditService.record(employee, EmployeeAuditAction.IDENTITY_UPDATED, Map.of(),
            Map.of("identityId", identity.getId(), "identityType", request.identityType().name(),
                "fields", List.of("number", "issuedDate", "issuedPlace", "expiresOn")),
            null, null, actor);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_IDENTITY_UPDATE)")
    @Transactional
    public void verify(Long employeeId, EmployeeIdentityType type,
                       EmployeeSensitiveDtos.IdentityVerificationRequest request) {
        Employee employee = access.employeeForUpdate(employeeId);
        EmployeeIdentity identity = repository.findForUpdate(employeeId, type).orElseThrow(this::notFound);
        if (request.version() != identity.getVersion()) throw versionConflict();
        String reason = clean(request.reason());
        if (request.status() == EmployeeIdentityVerificationStatus.REJECTED && reason == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR,
                "Identity rejection reason required", "A reason is required when rejecting an identity document.");
        }
        EmployeeIdentityVerificationStatus previous = identity.getVerificationStatus();
        identity.verify(request.status(), reason, access.actor());
        auditService.record(employee, EmployeeAuditAction.IDENTITY_VERIFICATION_CHANGED,
            Map.of("status", previous.name()), Map.of("identityId", identity.getId(), "status", request.status().name()),
            reason, null, access.actor());
    }

    private EmployeeSensitiveDtos.IdentityResponse map(EmployeeIdentity value, boolean full) {
        String number = full ? crypto.decrypt(value.getEncryptedNumber()) : "********" + value.getNumberLast4();
        return new EmployeeSensitiveDtos.IdentityResponse(value.getId(), value.getIdentityType(), number, !full,
            value.getIssuedDate(), value.getIssuedPlace(), value.getExpiresOn(), value.getVerificationStatus(),
            value.getVerificationReason(), value.getVerifiedAt(), value.getVersion(), value.getUpdatedAt());
    }

    private String normalize(EmployeeIdentityType type, String raw) {
        String value = raw == null ? "" : raw.replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
        boolean valid = switch (type) {
            case CITIZEN_ID -> value.matches("\\d{12}");
            case PASSPORT -> value.matches("[A-Z0-9]{6,20}");
            case OTHER -> value.matches("[A-Z0-9-]{4,30}");
        };
        if (!valid) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR,
                "Invalid employee identity number",
                type == EmployeeIdentityType.CITIZEN_ID
                    ? "Citizen ID must contain exactly 12 digits."
                    : "The identity number has an invalid format.");
        }
        return value;
    }

    private void validateDates(EmployeeSensitiveDtos.IdentityRequest request) {
        if (request.issuedDate() != null && request.expiresOn() != null
            && request.expiresOn().isBefore(request.issuedDate())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR,
                "Invalid identity dates", "The expiry date cannot be before the issue date.");
        }
    }

    private String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, ErrorCode.EMPLOYEE_IDENTITY_NOT_FOUND,
        "Employee identity not found", "The requested employee identity record does not exist."); }
    private ApiException duplicate() { return new ApiException(HttpStatus.CONFLICT, ErrorCode.EMPLOYEE_IDENTITY_DUPLICATE,
        "Employee identity already exists", "This identity number is already assigned to another employee."); }
    private ApiException versionConflict() { return new ApiException(HttpStatus.CONFLICT, ErrorCode.EMPLOYEE_VERSION_CONFLICT,
        "Employee identity version conflict", "The identity record changed. Reload it before saving again."); }
}
