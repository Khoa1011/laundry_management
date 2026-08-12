package com.laundry.management.employee.application;

public record EmployeeAccountLinkedEvent(
    Long employeeId,
    String employeeName,
    Long branchId,
    Long linkedUserId,
    Long actorUserId,
    long employeeVersion
) {
}
