package com.laundry.management.operations.application;

import com.laundry.management.auth.domain.AccountStatus;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.common.exception.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class OperationsAccess {
    private final CurrentUserProvider currentUsers;
    private final BranchRepository branches;

    public OperationsAccess(CurrentUserProvider currentUsers, BranchRepository branches) {
        this.currentUsers = currentUsers;
        this.branches = branches;
    }

    public Long branch(Long branchId) {
        Long authorized = currentUsers.resolveAuthorizedBranch(branchId);
        if (branches.findById(authorized).filter(b -> b.getStatus() == AccountStatus.ACTIVE).isEmpty()) {
            throw invalid("Selected branch is unavailable.");
        }
        return authorized;
    }

    public Long actor() { return currentUsers.getRequired().id(); }
    public boolean has(String permission) { return currentUsers.getRequired().permissions().contains(permission); }

    public static ApiException invalid(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.OPERATIONS_VALIDATION_ERROR,
            "Invalid master data", message);
    }

    public static ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, ErrorCode.OPERATIONS_NOT_FOUND,
            "Record not found", "The record is unavailable in the selected branch.");
    }

    public static void version(long actual, Long expected) {
        if (expected == null || actual != expected) throw new ApiException(HttpStatus.CONFLICT,
            ErrorCode.OPERATIONS_VERSION_CONFLICT, "Record changed", "Reload the latest record before saving.");
    }
}
