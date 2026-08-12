package com.laundry.management.employee.application;

import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.security.CurrentUser;
import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.employee.domain.Employee;
import com.laundry.management.employee.infrastructure.EmployeeBranchRepository;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class EmployeeAuthorizationService {

    private final CurrentUserProvider currentUserProvider;
    private final EmployeeBranchRepository branchRepository;

    public EmployeeAuthorizationService(
        CurrentUserProvider currentUserProvider,
        EmployeeBranchRepository branchRepository
    ) {
        this.currentUserProvider = currentUserProvider;
        this.branchRepository = branchRepository;
    }

    public CurrentUser currentUser() {
        return currentUserProvider.getRequired();
    }

    public boolean canManageAllBranches() {
        return currentUser().permissions().contains(PermissionCodes.EMPLOYEE_MANAGE_ALL_BRANCHES);
    }

    public boolean hasPermission(String permissionCode) {
        return currentUser().permissions().contains(permissionCode);
    }

    public void requirePermission(String permissionCode) {
        if (!hasPermission(permissionCode)) {
            throw forbidden("You do not have permission to perform this employee action.");
        }
    }

    public void requireEmployeeScope(Employee employee) {
        if (canManageAllBranches()) {
            return;
        }
        List<Long> branchIds = currentUser().branchIds();
        if (branchIds.isEmpty() || !branchRepository.existsActiveInScope(employee.getId(), branchIds)) {
            throw employeeNotFound();
        }
    }

    public void requireBranchesInScope(Collection<Long> requestedBranchIds) {
        if (canManageAllBranches()) {
            return;
        }
        Set<Long> allowed = Set.copyOf(currentUser().branchIds());
        if (requestedBranchIds.stream().anyMatch(branchId -> !allowed.contains(branchId))) {
            throw forbidden("One or more selected branches are outside your authorized branch scope.");
        }
    }

    public void requireUserScope(UserAccount user) {
        if (canManageAllBranches()) {
            return;
        }
        Set<Long> allowed = Set.copyOf(currentUser().branchIds());
        boolean hasBranches = !user.getBranchAssignments().isEmpty();
        boolean allBranchesInScope = user.getBranchAssignments().stream()
            .allMatch(assignment -> allowed.contains(assignment.getBranch().getId()));
        if (!hasBranches || !allBranchesInScope) {
            throw forbidden("The selected user account is outside your authorized branch scope.");
        }
    }

    public List<Long> queryBranchScope() {
        List<Long> branchIds = currentUser().branchIds();
        return branchIds.isEmpty() ? List.of(-1L) : List.copyOf(new LinkedHashSet<>(branchIds));
    }

    public void requireRequestedFilterBranch(Long branchId) {
        if (branchId != null) {
            requireBranchesInScope(List.of(branchId));
        }
    }

    public ApiException employeeNotFound() {
        return new ApiException(
            HttpStatus.NOT_FOUND,
            ErrorCode.EMPLOYEE_NOT_FOUND,
            "Employee not found",
            "The employee does not exist or is outside your authorized branch scope."
        );
    }

    public ApiException forbidden(String detail) {
        return new ApiException(
            HttpStatus.FORBIDDEN,
            ErrorCode.EMPLOYEE_SCOPE_DENIED,
            "Employee access denied",
            detail
        );
    }
}
