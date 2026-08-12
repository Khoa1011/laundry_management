package com.laundry.management.employee.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.employee.api.EmployeeDtos;
import com.laundry.management.employee.domain.Employee;
import com.laundry.management.employee.domain.EmployeeAuditAction;
import com.laundry.management.employee.domain.EmployeeAuditLog;
import com.laundry.management.employee.infrastructure.EmployeeAuditRepository;
import com.laundry.management.employee.infrastructure.EmployeeRepository;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmployeeAuditService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() { };

    private final EmployeeAuditRepository auditRepository;
    private final EmployeeRepository employeeRepository;
    private final EmployeeAuthorizationService authorizationService;
    private final ObjectMapper objectMapper;

    public EmployeeAuditService(
        EmployeeAuditRepository auditRepository,
        EmployeeRepository employeeRepository,
        EmployeeAuthorizationService authorizationService,
        ObjectMapper objectMapper
    ) {
        this.auditRepository = auditRepository;
        this.employeeRepository = employeeRepository;
        this.authorizationService = authorizationService;
        this.objectMapper = objectMapper;
    }

    public void record(
        Employee employee,
        EmployeeAuditAction action,
        Map<String, Object> oldValue,
        Map<String, Object> newValue,
        String reason,
        Branch branch,
        UserAccount actor
    ) {
        auditRepository.save(new EmployeeAuditLog(
            employee,
            action,
            serialize(oldValue),
            serialize(newValue),
            reason,
            branch,
            actor
        ));
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_AUDIT_READ)")
    @Transactional(readOnly = true)
    public EmployeeDtos.AuditListResponse list(Long employeeId, int page, int size) {
        validatePage(page, size);
        Employee employee = employeeRepository.findDetailById(employeeId)
            .orElseThrow(authorizationService::employeeNotFound);
        authorizationService.requireEmployeeScope(employee);
        var result = auditRepository.findByEmployeeId(
            employeeId,
            PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")))
        );
        return new EmployeeDtos.AuditListResponse(
            result.getContent().stream().map(this::toResponse).toList(),
            result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages()
        );
    }

    private EmployeeDtos.AuditResponse toResponse(EmployeeAuditLog audit) {
        var branch = audit.getBranch();
        return new EmployeeDtos.AuditResponse(
            audit.getId(), audit.getAction(), parse(audit.getOldValue()), parse(audit.getNewValue()),
            audit.getReason(),
            branch == null ? null : new EmployeeDtos.BranchOptionResponse(
                branch.getId(), branch.getCode(), branch.getName()
            ),
            new EmployeeDtos.ActorResponse(audit.getActor().getId(), audit.getActor().getDisplayName()),
            audit.getCreatedAt()
        );
    }

    private String serialize(Map<String, Object> value) {
        if (value == null || value.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize safe employee audit metadata", exception);
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
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                size > MAX_PAGE_SIZE ? ErrorCode.PAGE_SIZE_EXCEEDED : ErrorCode.VALIDATION_ERROR,
                "Invalid pagination",
                "Page must not be negative and size must be between 1 and 100."
            );
        }
    }
}
