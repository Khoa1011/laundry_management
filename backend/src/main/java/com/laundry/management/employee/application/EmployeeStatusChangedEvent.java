package com.laundry.management.employee.application;

import com.laundry.management.employee.domain.EmployeeStatus;

public record EmployeeStatusChangedEvent(
    Long employeeId,
    String employeeName,
    Long branchId,
    EmployeeStatus oldStatus,
    EmployeeStatus newStatus,
    Long actorUserId,
    long employeeVersion
) {
}
