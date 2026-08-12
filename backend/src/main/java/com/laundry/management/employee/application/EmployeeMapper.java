package com.laundry.management.employee.application;

import com.laundry.management.auth.domain.AccountStatus;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.employee.api.EmployeeDtos;
import com.laundry.management.employee.domain.Employee;
import com.laundry.management.employee.domain.EmployeeAccountState;
import com.laundry.management.employee.domain.EmployeeBranch;
import com.laundry.management.employee.domain.EmployeePosition;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class EmployeeMapper {

    public EmployeeDtos.ListItemResponse toListItem(Employee employee, List<EmployeeBranch> branches) {
        return new EmployeeDtos.ListItemResponse(
            employee.getId(),
            employee.getEmployeeCode(),
            employee.getFullName(),
            employee.getPhone(),
            employee.getEmail(),
            employee.getHireDate(),
            employee.getStatus(),
            toPosition(employee.getPosition()),
            branches.stream().filter(EmployeeBranch::isPrimary).findFirst().map(this::toBranch).orElse(null),
            branches.size(),
            toAccount(employee.getLinkedUser()),
            employee.getVersion(),
            employee.getUpdatedAt()
        );
    }

    public EmployeeDtos.DetailResponse toDetail(Employee employee, List<EmployeeBranch> branches) {
        return new EmployeeDtos.DetailResponse(
            employee.getId(),
            employee.getEmployeeCode(),
            employee.getFullName(),
            employee.getPhone(),
            employee.getEmail(),
            employee.getBirthDate(),
            employee.getAddress(),
            employee.getAdministrativeVersion(),
            employee.getProvince(),
            employee.getProvinceCode(),
            employee.getDistrict(),
            employee.getDistrictCode(),
            employee.getWard(),
            employee.getWardCode(),
            employee.getHireDate(),
            employee.getStatus(),
            toPosition(employee.getPosition()),
            branches.stream().map(this::toBranch).toList(),
            toAccount(employee.getLinkedUser()),
            employee.getVersion(),
            employee.getCreatedAt(),
            employee.getUpdatedAt()
        );
    }

    public EmployeeDtos.SelfProfileResponse toSelf(Employee employee, List<EmployeeBranch> branches) {
        return new EmployeeDtos.SelfProfileResponse(
            employee.getId(),
            employee.getEmployeeCode(),
            employee.getFullName(),
            employee.getPhone(),
            employee.getEmail(),
            employee.getBirthDate(),
            employee.getAddress(),
            employee.getAdministrativeVersion(),
            employee.getProvince(),
            employee.getProvinceCode(),
            employee.getDistrict(),
            employee.getDistrictCode(),
            employee.getWard(),
            employee.getWardCode(),
            employee.getHireDate(),
            employee.getStatus(),
            toPosition(employee.getPosition()),
            branches.stream().map(this::toBranch).toList(),
            accountState(employee.getLinkedUser()),
            employee.getVersion(),
            employee.getUpdatedAt()
        );
    }

    public EmployeeDtos.PositionResponse toPosition(EmployeePosition position) {
        return new EmployeeDtos.PositionResponse(
            position.getId(), position.getCode(), position.getNameVi(), position.getNameEn(),
            position.getDescriptionVi(), position.getDescriptionEn(), position.isActive(),
            position.getSortOrder(), position.getVersion()
        );
    }

    public EmployeeDtos.BranchResponse toBranch(EmployeeBranch assignment) {
        var branch = assignment.getBranch();
        return new EmployeeDtos.BranchResponse(
            branch.getId(), branch.getCode(), branch.getName(), assignment.isPrimary(), assignment.isActive(),
            assignment.getAssignedAt(), assignment.getUnassignedAt()
        );
    }

    public EmployeeDtos.AccountResponse toAccount(UserAccount user) {
        if (user == null) {
            return null;
        }
        return new EmployeeDtos.AccountResponse(
            user.getId(), user.getUsername(), user.getDisplayName(), accountState(user), accountBranches(user)
        );
    }

    public EmployeeDtos.AccountOptionResponse toAccountOption(UserAccount user) {
        return new EmployeeDtos.AccountOptionResponse(
            user.getId(), user.getUsername(), user.getDisplayName(), accountState(user), accountBranches(user)
        );
    }

    public EmployeeAccountState accountState(UserAccount user) {
        if (user == null) {
            return EmployeeAccountState.NO_ACCOUNT;
        }
        if (user.isLocked()) {
            return EmployeeAccountState.ACCOUNT_LOCKED;
        }
        return user.getStatus() == AccountStatus.ACTIVE
            ? EmployeeAccountState.ACCOUNT_ACTIVE
            : EmployeeAccountState.ACCOUNT_INACTIVE;
    }

    private List<EmployeeDtos.AccountBranchResponse> accountBranches(UserAccount user) {
        return user.getBranchAssignments().stream()
            .map(assignment -> new EmployeeDtos.AccountBranchResponse(
                assignment.getBranch().getId(),
                assignment.getBranch().getCode(),
                assignment.getBranch().getName()
            ))
            .sorted((left, right) -> left.code().compareTo(right.code()))
            .toList();
    }
}
