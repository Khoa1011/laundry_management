package com.laundry.management.employee.application;

public record EmployeeBranchChangedEvent(
    Long employeeId,
    String employeeName,
    Long branchId,
    String branchName,
    String changeType,
    Long actorUserId,
    long employeeVersion
) {
}
