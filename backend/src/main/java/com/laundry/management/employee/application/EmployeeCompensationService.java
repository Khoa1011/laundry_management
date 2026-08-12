package com.laundry.management.employee.application;

import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.employee.api.EmployeeSensitiveDtos;
import com.laundry.management.employee.domain.*;
import com.laundry.management.employee.infrastructure.EmployeeCompensationRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmployeeCompensationService {
    private static final int MAX_PAGE_SIZE = 100;
    private final EmployeeCompensationRepository repository;
    private final EmployeeSensitiveAccessService access;
    private final EmployeeAuditService auditService;

    public EmployeeCompensationService(EmployeeCompensationRepository repository,
                                       EmployeeSensitiveAccessService access,
                                       EmployeeAuditService auditService) {
        this.repository = repository;
        this.access = access;
        this.auditService = auditService;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_COMPENSATION_READ)")
    @Transactional
    public EmployeeSensitiveDtos.CompensationCurrentResponse current(Long employeeId) {
        Employee employee = access.employee(employeeId);
        LocalDate today = LocalDate.now();
        List<EmployeeCompensation> periods = repository.findByEmployeeIdOrderByEffectiveFromDescIdDesc(employeeId);
        reconcile(periods, today);
        EmployeeCompensation current = periods.stream()
            .filter(period -> !period.getEffectiveFrom().isAfter(today))
            .filter(period -> period.getEffectiveTo() == null || !period.getEffectiveTo().isBefore(today))
            .findFirst().orElse(null);
        EmployeeCompensation scheduled = periods.stream()
            .filter(period -> period.getEffectiveFrom().isAfter(today))
            .min((left, right) -> left.getEffectiveFrom().compareTo(right.getEffectiveFrom()))
            .orElse(null);
        auditService.record(employee, EmployeeAuditAction.COMPENSATION_VIEWED, Map.of(),
            Map.of("compensationId", current == null ? 0L : current.getId()), null, null, access.actor());
        return new EmployeeSensitiveDtos.CompensationCurrentResponse(map(current, today), map(scheduled, today));
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_COMPENSATION_HISTORY_READ)")
    @Transactional
    public EmployeeSensitiveDtos.CompensationHistoryResponse history(Long employeeId, int page, int size) {
        validatePage(page, size);
        Employee employee = access.employee(employeeId);
        var result = repository.findByEmployeeId(employeeId,
            PageRequest.of(page, size, Sort.by(Sort.Order.desc("effectiveFrom"), Sort.Order.desc("id"))));
        auditService.record(employee, EmployeeAuditAction.COMPENSATION_HISTORY_VIEWED, Map.of(),
            Map.of("page", page), null, null, access.actor());
        LocalDate today = LocalDate.now();
        reconcile(result.getContent(), today);
        return new EmployeeSensitiveDtos.CompensationHistoryResponse(
            result.getContent().stream().map(item -> map(item, today)).toList(),
            result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_COMPENSATION_UPDATE)")
    @Transactional
    public EmployeeSensitiveDtos.CompensationResponse update(
        Long employeeId, EmployeeSensitiveDtos.CompensationRequest request
    ) {
        Employee employee = access.employeeForUpdate(employeeId);
        UserAccount actor = access.actor();
        LocalDate effectiveFrom = request.effectiveFrom();
        List<EmployeeCompensation> periods = repository.findByEmployeeIdOrderByEffectiveFromDescIdDesc(employeeId);
        reconcile(periods, LocalDate.now());
        EmployeeCompensation overlapping = null;
        for (EmployeeCompensation period : periods) {
            if (!period.getEffectiveFrom().isBefore(effectiveFrom)) {
                throw periodConflict();
            }
            if (period.getEffectiveTo() == null || !period.getEffectiveTo().isBefore(effectiveFrom)) {
                if (overlapping != null) throw periodConflict();
                overlapping = period;
            }
        }
        if (overlapping != null) {
            overlapping.endOn(effectiveFrom.minusDays(1), actor);
        }
        EmployeeCompensation created = repository.save(new EmployeeCompensation(
            employee,
            request.baseSalary(),
            request.currency().trim().toUpperCase(),
            effectiveFrom,
            effectiveFrom.isAfter(LocalDate.now())
                ? EmployeeCompensationStatus.SCHEDULED : EmployeeCompensationStatus.ACTIVE,
            request.reason().trim(),
            actor
        ));
        repository.flush();
        auditService.record(employee, EmployeeAuditAction.COMPENSATION_UPDATED, Map.of(),
            Map.of("compensationId", created.getId(), "effectiveFrom", effectiveFrom.toString()),
            request.reason().trim(), null, actor);
        return map(created, LocalDate.now());
    }

    private EmployeeSensitiveDtos.CompensationResponse map(EmployeeCompensation value, LocalDate today) {
        if (value == null) return null;
        EmployeeCompensationStatus effectiveStatus = value.getEffectiveFrom().isAfter(today)
            ? EmployeeCompensationStatus.SCHEDULED
            : value.getEffectiveTo() != null && value.getEffectiveTo().isBefore(today)
                ? EmployeeCompensationStatus.ENDED : EmployeeCompensationStatus.ACTIVE;
        return new EmployeeSensitiveDtos.CompensationResponse(
            value.getId(), value.getBaseSalary(), value.getCurrency(), value.getEffectiveFrom(),
            value.getEffectiveTo(), effectiveStatus, value.getReason(), value.getVersion(),
            new EmployeeSensitiveDtos.ActorResponse(value.getCreatedBy().getId(), value.getCreatedBy().getDisplayName()),
            value.getCreatedAt());
    }

    private void reconcile(List<EmployeeCompensation> periods, LocalDate today) {
        periods.forEach(period -> {
            EmployeeCompensationStatus status = period.getEffectiveFrom().isAfter(today)
                ? EmployeeCompensationStatus.SCHEDULED
                : period.getEffectiveTo() != null && period.getEffectiveTo().isBefore(today)
                    ? EmployeeCompensationStatus.ENDED : EmployeeCompensationStatus.ACTIVE;
            if (period.getStatus() != status) period.reconcileStatus(status);
        });
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                size > MAX_PAGE_SIZE ? ErrorCode.PAGE_SIZE_EXCEEDED : ErrorCode.VALIDATION_ERROR,
                "Invalid pagination", "Page must not be negative and size must be between 1 and 100.");
        }
    }

    private ApiException periodConflict() {
        return new ApiException(HttpStatus.CONFLICT, ErrorCode.EMPLOYEE_COMPENSATION_PERIOD_CONFLICT,
            "Employee compensation period conflict",
            "The effective date overlaps or precedes an existing compensation period.");
    }
}
