package com.laundry.management.employee.application;

import com.laundry.management.auth.domain.AccountStatus;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.employee.api.EmployeeDtos;
import com.laundry.management.employee.domain.EmployeeAccountState;
import com.laundry.management.employee.domain.EmployeeBranch;
import com.laundry.management.employee.domain.EmployeeStatus;
import com.laundry.management.employee.infrastructure.EmployeeBranchRepository;
import com.laundry.management.employee.infrastructure.EmployeePositionRepository;
import com.laundry.management.employee.infrastructure.EmployeeRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmployeeQueryService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final Map<String, String> ALLOWED_SORTS = allowedSorts();

    private final EmployeeRepository employeeRepository;
    private final EmployeeBranchRepository employeeBranchRepository;
    private final EmployeePositionRepository positionRepository;
    private final UserAccountRepository userRepository;
    private final BranchRepository branchRepository;
    private final EmployeeAuthorizationService authorizationService;
    private final EmployeeMapper mapper;

    public EmployeeQueryService(
        EmployeeRepository employeeRepository,
        EmployeeBranchRepository employeeBranchRepository,
        EmployeePositionRepository positionRepository,
        UserAccountRepository userRepository,
        BranchRepository branchRepository,
        EmployeeAuthorizationService authorizationService,
        EmployeeMapper mapper
    ) {
        this.employeeRepository = employeeRepository;
        this.employeeBranchRepository = employeeBranchRepository;
        this.positionRepository = positionRepository;
        this.userRepository = userRepository;
        this.branchRepository = branchRepository;
        this.authorizationService = authorizationService;
        this.mapper = mapper;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_READ)")
    @Transactional(readOnly = true)
    public EmployeeDtos.ListResponse list(
        int page,
        int size,
        String keyword,
        EmployeeStatus status,
        Long positionId,
        Long branchId,
        Boolean hasLinkedAccount,
        EmployeeAccountState accountStatus,
        List<String> requestedSort
    ) {
        validatePage(page, size);
        authorizationService.requireRequestedFilterBranch(branchId);
        String accountFilter = resolveAccountFilter(hasLinkedAccount, accountStatus);
        Sort sort = parseSort(requestedSort);
        String searchPattern = normalizeSearch(keyword);
        boolean allBranches = authorizationService.canManageAllBranches();
        var result = employeeRepository.search(
            allBranches,
            authorizationService.queryBranchScope(),
            branchId,
            status,
            positionId,
            accountFilter,
            searchPattern,
            PageRequest.of(page, size, sort)
        );
        List<Long> employeeIds = result.getContent().stream().map(employee -> employee.getId()).toList();
        Map<Long, List<EmployeeBranch>> branchesByEmployee = employeeIds.isEmpty()
            ? Map.of()
            : employeeBranchRepository.findActiveByEmployeeIds(employeeIds).stream()
                .collect(Collectors.groupingBy(
                    assignment -> assignment.getEmployee().getId(),
                    LinkedHashMap::new,
                    Collectors.toList()
                ));
        return new EmployeeDtos.ListResponse(
            result.getContent().stream()
                .map(employee -> mapper.toListItem(
                    employee,
                    branchesByEmployee.getOrDefault(employee.getId(), List.of())
                ))
                .toList(),
            result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages(),
            sort.stream().map(order -> new EmployeeDtos.SortResponse(
                externalSortName(order.getProperty()), order.getDirection().name()
            )).toList()
        );
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_READ)")
    @Transactional(readOnly = true)
    public EmployeeDtos.DetailResponse get(Long employeeId) {
        var employee = employeeRepository.findDetailById(employeeId)
            .orElseThrow(authorizationService::employeeNotFound);
        authorizationService.requireEmployeeScope(employee);
        return mapper.toDetail(employee, employeeBranchRepository.findActiveByEmployeeId(employeeId));
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_READ_SELF)")
    @Transactional(readOnly = true)
    public EmployeeDtos.SelfProfileResponse me() {
        var employee = employeeRepository.findByLinkedUserId(authorizationService.currentUser().id())
            .orElseThrow(() -> new ApiException(
                HttpStatus.NOT_FOUND,
                ErrorCode.EMPLOYEE_SELF_PROFILE_NOT_FOUND,
                "Employee self profile not found",
                "The current account is not linked to an employee profile."
            ));
        return mapper.toSelf(employee, employeeBranchRepository.findActiveByEmployeeId(employee.getId()));
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_READ)")
    @Transactional(readOnly = true)
    public List<EmployeeDtos.BranchResponse> branches(Long employeeId, boolean includeHistory) {
        var employee = employeeRepository.findDetailById(employeeId)
            .orElseThrow(authorizationService::employeeNotFound);
        authorizationService.requireEmployeeScope(employee);
        var assignments = includeHistory
            ? employeeBranchRepository.findHistoryByEmployeeId(employeeId)
            : employeeBranchRepository.findActiveByEmployeeId(employeeId);
        return assignments.stream().map(mapper::toBranch).toList();
    }

    @PreAuthorize("@permissionChecker.hasAny(authentication, "
        + "T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_POSITION_READ, "
        + "T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_POSITION_MANAGE, "
        + "T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_POSITION_ASSIGN, "
        + "T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_CREATE, "
        + "T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_READ)")
    @Transactional(readOnly = true)
    public List<EmployeeDtos.PositionResponse> positions(boolean includeInactive) {
        if (includeInactive
            && !authorizationService.hasPermission(PermissionCodes.EMPLOYEE_POSITION_READ)
            && !authorizationService.hasPermission(PermissionCodes.EMPLOYEE_POSITION_MANAGE)) {
            throw authorizationService.forbidden("You do not have permission to view inactive employee positions.");
        }
        var positions = includeInactive
            ? positionRepository.findAllByOrderBySortOrderAscNameViAscIdAsc()
            : positionRepository.findByActiveTrueOrderBySortOrderAscNameViAscIdAsc();
        return positions.stream().map(mapper::toPosition).toList();
    }

    @PreAuthorize("@permissionChecker.hasAny(authentication, "
        + "T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_READ, "
        + "T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_CREATE, "
        + "T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_BRANCH_ASSIGN)")
    @Transactional(readOnly = true)
    public List<EmployeeDtos.BranchOptionResponse> branchOptions() {
        Collection<Long> allowed = authorizationService.queryBranchScope();
        return branchRepository.findAll().stream()
            .filter(branch -> authorizationService.canManageAllBranches() || allowed.contains(branch.getId()))
            .filter(branch -> branch.getStatus() == AccountStatus.ACTIVE)
            .sorted(Comparator.comparing(branch -> branch.getName().toLowerCase(Locale.ROOT)))
            .map(branch -> new EmployeeDtos.BranchOptionResponse(
                branch.getId(), branch.getCode(), branch.getName()
            ))
            .toList();
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_ACCOUNT_LINK)")
    @Transactional(readOnly = true)
    public EmployeeDtos.AccountOptionListResponse accountOptions(
        Long employeeId,
        String keyword,
        int page,
        int size
    ) {
        validatePage(page, size);
        String search = normalizeSearch(keyword);
        var result = userRepository.searchEmployeeLinkCandidates(
            search,
            authorizationService.canManageAllBranches(),
            authorizationService.queryBranchScope(),
            employeeId,
            PageRequest.of(page, size, Sort.by(
                Sort.Order.asc("displayName"), Sort.Order.asc("username"), Sort.Order.asc("id")
            ))
        );
        return new EmployeeDtos.AccountOptionListResponse(
            result.getContent().stream().map(mapper::toAccountOption).toList(),
            result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages()
        );
    }

    private String resolveAccountFilter(Boolean hasLinkedAccount, EmployeeAccountState accountStatus) {
        if (accountStatus != null) {
            if (Boolean.FALSE.equals(hasLinkedAccount) && accountStatus != EmployeeAccountState.NO_ACCOUNT) {
                throw validation("Account filters conflict with each other.");
            }
            return accountStatus.name();
        }
        if (Boolean.FALSE.equals(hasLinkedAccount)) {
            return EmployeeAccountState.NO_ACCOUNT.name();
        }
        if (Boolean.TRUE.equals(hasLinkedAccount)) {
            return "HAS_ACCOUNT";
        }
        return null;
    }

    private String normalizeSearch(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        String escaped = keyword.trim().toLowerCase(Locale.ROOT)
            .replace("!", "!!").replace("%", "!%").replace("_", "!_");
        return "%" + escaped + "%";
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1) {
            throw validation("Page must not be negative and size must be positive.");
        }
        if (size > MAX_PAGE_SIZE) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                ErrorCode.PAGE_SIZE_EXCEEDED,
                "Page size exceeded",
                "Page size must not exceed 100."
            );
        }
    }

    private Sort parseSort(List<String> requestedSort) {
        if (requestedSort == null || requestedSort.isEmpty()) {
            return Sort.by(Sort.Order.asc("employeeCode"), Sort.Order.asc("id"));
        }
        List<Sort.Order> orders = new ArrayList<>();
        for (String rawSort : requestedSort) {
            String[] parts = rawSort.split(",", -1);
            String property = ALLOWED_SORTS.get(parts[0].trim());
            if (property == null || parts.length > 2) {
                throw invalidSort();
            }
            try {
                Sort.Direction direction = parts.length == 1 || parts[1].isBlank()
                    ? Sort.Direction.ASC
                    : Sort.Direction.fromString(parts[1]);
                orders.add(new Sort.Order(direction, property));
            } catch (IllegalArgumentException exception) {
                throw invalidSort();
            }
        }
        if (orders.stream().noneMatch(order -> order.getProperty().equals("id"))) {
            orders.add(Sort.Order.asc("id"));
        }
        return Sort.by(orders);
    }

    private String externalSortName(String internalName) {
        return ALLOWED_SORTS.entrySet().stream()
            .filter(entry -> entry.getValue().equals(internalName))
            .map(Map.Entry::getKey)
            .findFirst()
            .orElse(internalName);
    }

    private ApiException invalidSort() {
        return new ApiException(
            HttpStatus.BAD_REQUEST,
            ErrorCode.INVALID_SORT,
            "Invalid sort",
            "Sort by employeeCode, fullName, hireDate, status, createdAt, or updatedAt."
        );
    }

    private ApiException validation(String detail) {
        return new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, "Validation failed", detail);
    }

    private static Map<String, String> allowedSorts() {
        Map<String, String> sorts = new LinkedHashMap<>();
        sorts.put("employeeCode", "employeeCode");
        sorts.put("fullName", "fullName");
        sorts.put("hireDate", "hireDate");
        sorts.put("status", "status");
        sorts.put("createdAt", "createdAt");
        sorts.put("updatedAt", "updatedAt");
        return Map.copyOf(sorts);
    }
}
