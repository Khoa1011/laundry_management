package com.laundry.management.employee.application;

import com.laundry.management.auth.domain.AccountStatus;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.employee.api.EmployeeDtos;
import com.laundry.management.employee.domain.Employee;
import com.laundry.management.employee.domain.EmployeeAuditAction;
import com.laundry.management.employee.domain.EmployeeBranch;
import com.laundry.management.employee.domain.EmployeePosition;
import com.laundry.management.employee.domain.EmployeeStatus;
import com.laundry.management.employee.infrastructure.EmployeeBranchRepository;
import com.laundry.management.employee.infrastructure.EmployeePositionRepository;
import com.laundry.management.employee.infrastructure.EmployeeRepository;
import com.laundry.management.location.application.AdministrativeAddressValidator;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmployeeCommandService {

    private final EmployeeRepository employeeRepository;
    private final EmployeeBranchRepository employeeBranchRepository;
    private final EmployeePositionRepository positionRepository;
    private final UserAccountRepository userRepository;
    private final BranchRepository branchRepository;
    private final EmployeeAuthorizationService authorizationService;
    private final EmployeeDataNormalizer normalizer;
    private final EmployeeCodeGenerator codeGenerator;
    private final EmployeeAuditService auditService;
    private final EmployeeMapper mapper;
    private final EmployeeNotificationEventPublisher notificationEventPublisher;

    public EmployeeCommandService(
        EmployeeRepository employeeRepository,
        EmployeeBranchRepository employeeBranchRepository,
        EmployeePositionRepository positionRepository,
        UserAccountRepository userRepository,
        BranchRepository branchRepository,
        EmployeeAuthorizationService authorizationService,
        EmployeeDataNormalizer normalizer,
        EmployeeCodeGenerator codeGenerator,
        EmployeeAuditService auditService,
        EmployeeMapper mapper,
        EmployeeNotificationEventPublisher notificationEventPublisher
    ) {
        this.employeeRepository = employeeRepository;
        this.employeeBranchRepository = employeeBranchRepository;
        this.positionRepository = positionRepository;
        this.userRepository = userRepository;
        this.branchRepository = branchRepository;
        this.authorizationService = authorizationService;
        this.normalizer = normalizer;
        this.codeGenerator = codeGenerator;
        this.auditService = auditService;
        this.mapper = mapper;
        this.notificationEventPublisher = notificationEventPublisher;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_CREATE)")
    @Transactional
    public EmployeeDtos.DetailResponse create(EmployeeDtos.CreateRequest request) {
        validateInitialStatus(request.status());
        validateAddress(request);
        Set<Long> branchIds = uniqueBranchIds(request.branchIds());
        if (!branchIds.contains(request.primaryBranchId())) {
            throw primaryBranchRequired();
        }
        authorizationService.requireBranchesInScope(branchIds);
        List<Branch> branches = activeBranches(branchIds);
        EmployeePosition position = activePosition(request.positionId());
        UserAccount actor = actor();
        var phone = normalizer.phone(request.phone());
        Employee employee = new Employee(
            codeGenerator.nextCode(),
            normalizer.meaningfulName(request.fullName()),
            phone.display(),
            phone.normalized(),
            normalizer.email(request.email()),
            request.birthDate(),
            normalizer.optionalText(request.address()),
            request.administrativeVersion(),
            normalizer.optionalText(request.province()),
            request.provinceCode(),
            normalizer.optionalText(request.district()),
            request.districtCode(),
            normalizer.optionalText(request.ward()),
            request.wardCode(),
            request.hireDate(),
            position,
            request.status(),
            actor
        );
        if (request.linkedUserId() != null) {
            authorizationService.requirePermission(PermissionCodes.EMPLOYEE_ACCOUNT_LINK);
            employee.linkUser(linkableUser(request.linkedUserId(), null), actor);
        }
        try {
            Employee persistedEmployee = employeeRepository.saveAndFlush(employee);
            Instant now = Instant.now();
            List<EmployeeBranch> assignments = branches.stream()
                .map(branch -> new EmployeeBranch(
                    persistedEmployee, branch, branch.getId().equals(request.primaryBranchId()), actor, now
                ))
                .toList();
            employeeBranchRepository.saveAll(assignments);
            employeeBranchRepository.flush();
            auditService.record(
                persistedEmployee,
                EmployeeAuditAction.EMPLOYEE_CREATED,
                Map.of(),
                creationMetadata(persistedEmployee, branchIds),
                null,
                null,
                actor
            );
            return mapper.toDetail(persistedEmployee, assignments);
        } catch (DataIntegrityViolationException exception) {
            throw translateIntegrityViolation(exception);
        }
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_UPDATE)")
    @Transactional
    public EmployeeDtos.DetailResponse update(Long employeeId, EmployeeDtos.UpdateRequest request) {
        validateAddress(request);
        Employee employee = employeeForUpdate(employeeId, request.version());
        UserAccount actor = actor();
        var phone = normalizer.phone(request.phone());
        List<String> changedFields = changedProfileFields(employee, request, phone);
        employee.updateProfile(
            normalizer.meaningfulName(request.fullName()),
            phone.display(),
            phone.normalized(),
            normalizer.email(request.email()),
            request.birthDate(),
            normalizer.optionalText(request.address()),
            request.administrativeVersion(),
            normalizer.optionalText(request.province()),
            request.provinceCode(),
            normalizer.optionalText(request.district()),
            request.districtCode(),
            normalizer.optionalText(request.ward()),
            request.wardCode(),
            request.hireDate(),
            actor
        );
        employeeRepository.flush();
        if (!changedFields.isEmpty()) {
            auditService.record(
                employee,
                EmployeeAuditAction.EMPLOYEE_UPDATED,
                Map.of(),
                Map.of("fields", changedFields),
                null,
                null,
                actor
            );
        }
        return detail(employee);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_STATUS_CHANGE)")
    @Transactional
    public EmployeeDtos.DetailResponse changeStatus(Long employeeId, EmployeeDtos.StatusRequest request) {
        Employee employee = employeeForUpdate(employeeId, request.version());
        EmployeeStatus oldStatus = employee.getStatus();
        if (oldStatus == request.status()) {
            return detail(employee);
        }
        requireValidTransition(oldStatus, request.status());
        String reason = normalizer.optionalText(request.reason());
        if ((request.status() == EmployeeStatus.SUSPENDED || request.status() == EmployeeStatus.TERMINATED)
            && reason == null) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                ErrorCode.EMPLOYEE_STATUS_REASON_REQUIRED,
                "Employee status reason required",
                "A reason is required when suspending or terminating an employee."
            );
        }
        UserAccount actor = actor();
        UserAccount linkedUser = employee.getLinkedUser();
        if (linkedUser != null
            && linkedUser.getId().equals(actor.getId())
            && (request.status() == EmployeeStatus.SUSPENDED || request.status() == EmployeeStatus.TERMINATED)) {
            throw new ApiException(
                HttpStatus.CONFLICT,
                ErrorCode.SELF_LOCKOUT_PREVENTED,
                "Self lockout prevented",
                "You cannot suspend or terminate the employee profile linked to your current account."
            );
        }
        employee.changeStatus(request.status(), actor);
        auditService.record(
            employee,
            EmployeeAuditAction.EMPLOYEE_STATUS_CHANGED,
            Map.of("status", oldStatus.name()),
            Map.of("status", request.status().name()),
            reason,
            null,
            actor
        );
        if (linkedUser != null
            && (request.status() == EmployeeStatus.SUSPENDED || request.status() == EmployeeStatus.TERMINATED)) {
            UserAccount lockedUser = userRepository.findByIdForUpdate(linkedUser.getId())
                .orElseThrow(this::userNotFound);
            if (lockedUser.lock(reason, actor)) {
                auditService.record(
                    employee,
                    EmployeeAuditAction.LINKED_USER_LOCKED,
                    Map.of("locked", false),
                    Map.of("locked", true, "userId", lockedUser.getId()),
                    reason,
                    null,
                    actor
                );
                notificationEventPublisher.publish(new EmployeeLinkedAccountLockedEvent(lockedUser.getId()));
            }
        }
        employeeRepository.flush();
        EmployeeBranch statusBranch = primaryBranch(employeeId);
        notificationEventPublisher.publish(new EmployeeStatusChangedEvent(
            employee.getId(),
            employee.getFullName(),
            statusBranch.getBranch().getId(),
            oldStatus,
            request.status(),
            actor.getId(),
            employee.getVersion()
        ));
        return detail(employee);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_POSITION_ASSIGN)")
    @Transactional
    public EmployeeDtos.DetailResponse assignPosition(
        Long employeeId,
        EmployeeDtos.PositionAssignmentRequest request
    ) {
        Employee employee = employeeForUpdate(employeeId, request.version());
        EmployeePosition position = activePosition(request.positionId());
        Long oldPositionId = employee.getPosition().getId();
        if (!oldPositionId.equals(position.getId())) {
            UserAccount actor = actor();
            employee.changePosition(position, actor);
            employeeRepository.flush();
            auditService.record(
                employee,
                EmployeeAuditAction.EMPLOYEE_POSITION_CHANGED,
                Map.of("positionId", oldPositionId),
                Map.of("positionId", position.getId()),
                null,
                null,
                actor
            );
        }
        return detail(employee);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_BRANCH_ASSIGN)")
    @Transactional
    public EmployeeDtos.DetailResponse assignBranch(
        Long employeeId,
        EmployeeDtos.BranchAssignmentRequest request
    ) {
        Employee employee = employeeForUpdate(employeeId, request.version());
        authorizationService.requireBranchesInScope(List.of(request.branchId()));
        Branch branch = activeBranches(Set.of(request.branchId())).get(0);
        List<EmployeeBranch> assignments = employeeBranchRepository.findActiveByEmployeeIdForUpdate(employeeId);
        if (assignments.stream().anyMatch(item -> item.getBranch().getId().equals(branch.getId()))) {
            throw new ApiException(
                HttpStatus.CONFLICT,
                ErrorCode.EMPLOYEE_BRANCH_DUPLICATE,
                "Employee branch already assigned",
                "The employee already has an active assignment to this branch."
            );
        }
        UserAccount actor = actor();
        if (request.primary()) {
            assignments.forEach(EmployeeBranch::clearPrimary);
            employeeBranchRepository.flush();
        }
        EmployeeBranch assignment = employeeBranchRepository.save(
            new EmployeeBranch(employee, branch, request.primary(), actor, Instant.now())
        );
        employee.markChanged(actor);
        employeeRepository.flush();
        employeeBranchRepository.flush();
        auditService.record(
            employee,
            EmployeeAuditAction.EMPLOYEE_BRANCH_ASSIGNED,
            Map.of(),
            Map.of("branchId", branch.getId(), "primary", request.primary()),
            null,
            branch,
            actor
        );
        notificationEventPublisher.publish(new EmployeeBranchChangedEvent(
            employee.getId(),
            employee.getFullName(),
            branch.getId(),
            branch.getName(),
            request.primary() ? "ASSIGNED_PRIMARY" : "ASSIGNED",
            actor.getId(),
            employee.getVersion()
        ));
        List<EmployeeBranch> updated = new ArrayList<>(assignments);
        updated.add(assignment);
        return mapper.toDetail(employee, sortAssignments(updated));
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_BRANCH_ASSIGN)")
    @Transactional
    public EmployeeDtos.DetailResponse makePrimaryBranch(
        Long employeeId,
        Long branchId,
        EmployeeDtos.VersionRequest request
    ) {
        Employee employee = employeeForUpdate(employeeId, request.version());
        List<EmployeeBranch> assignments = employeeBranchRepository.findActiveByEmployeeIdForUpdate(employeeId);
        EmployeeBranch selected = assignments.stream()
            .filter(item -> item.getBranch().getId().equals(branchId))
            .findFirst()
            .orElseThrow(this::branchAssignmentNotFound);
        authorizationService.requireBranchesInScope(List.of(branchId));
        if (!selected.isPrimary()) {
            Long oldPrimaryId = assignments.stream().filter(EmployeeBranch::isPrimary)
                .map(item -> item.getBranch().getId()).findFirst().orElse(null);
            assignments.forEach(EmployeeBranch::clearPrimary);
            employeeBranchRepository.flush();
            selected.makePrimary();
            UserAccount actor = actor();
            employee.markChanged(actor);
            employeeRepository.flush();
            employeeBranchRepository.flush();
            Map<String, Object> oldValue = oldPrimaryId == null
                ? Map.of()
                : Map.of("branchId", oldPrimaryId);
            auditService.record(
                employee,
                EmployeeAuditAction.EMPLOYEE_PRIMARY_BRANCH_CHANGED,
                oldValue,
                Map.of("branchId", branchId),
                null,
                selected.getBranch(),
                actor
            );
            notificationEventPublisher.publish(new EmployeeBranchChangedEvent(
                employee.getId(),
                employee.getFullName(),
                selected.getBranch().getId(),
                selected.getBranch().getName(),
                "PRIMARY_CHANGED",
                actor.getId(),
                employee.getVersion()
            ));
        }
        return mapper.toDetail(employee, sortAssignments(assignments));
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_BRANCH_REMOVE)")
    @Transactional
    public EmployeeDtos.DetailResponse removeBranch(
        Long employeeId,
        Long branchId,
        EmployeeDtos.VersionRequest request
    ) {
        Employee employee = employeeForUpdate(employeeId, request.version());
        List<EmployeeBranch> assignments = employeeBranchRepository.findActiveByEmployeeIdForUpdate(employeeId);
        EmployeeBranch selected = assignments.stream()
            .filter(item -> item.getBranch().getId().equals(branchId))
            .findFirst()
            .orElseThrow(this::branchAssignmentNotFound);
        authorizationService.requireBranchesInScope(List.of(branchId));
        if (assignments.size() == 1 && employee.getStatus() != EmployeeStatus.TERMINATED) {
            throw new ApiException(
                HttpStatus.CONFLICT,
                ErrorCode.EMPLOYEE_LAST_BRANCH,
                "Last employee branch cannot be removed",
                "An employee must retain at least one branch unless their status is TERMINATED."
            );
        }
        if (selected.isPrimary() && assignments.size() > 1) {
            throw primaryBranchRequired();
        }
        boolean wasPrimary = selected.isPrimary();
        UserAccount actor = actor();
        selected.unassign(Instant.now());
        employee.markChanged(actor);
        employeeRepository.flush();
        employeeBranchRepository.flush();
        auditService.record(
            employee,
            EmployeeAuditAction.EMPLOYEE_BRANCH_REMOVED,
            Map.of("branchId", branchId, "primary", wasPrimary),
            Map.of(),
            null,
            selected.getBranch(),
            actor
        );
        assignments.stream()
            .filter(item -> item != selected && item.isActive())
            .findFirst()
            .ifPresent(remaining -> notificationEventPublisher.publish(new EmployeeBranchChangedEvent(
                employee.getId(),
                employee.getFullName(),
                remaining.getBranch().getId(),
                remaining.getBranch().getName(),
                "REMOVED",
                actor.getId(),
                employee.getVersion()
            )));
        return mapper.toDetail(
            employee,
            assignments.stream().filter(item -> item != selected).toList()
        );
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_ACCOUNT_LINK)")
    @Transactional
    public EmployeeDtos.DetailResponse linkAccount(
        Long employeeId,
        EmployeeDtos.AccountLinkRequest request
    ) {
        Employee employee = employeeForUpdate(employeeId, request.version());
        if (employee.getLinkedUser() != null && !employee.getLinkedUser().getId().equals(request.userId())) {
            throw accountAlreadyLinked();
        }
        if (employee.getLinkedUser() == null) {
            UserAccount actor = actor();
            UserAccount user = linkableUser(request.userId(), employeeId);
            employee.linkUser(user, actor);
            employeeRepository.flush();
            auditService.record(
                employee,
                EmployeeAuditAction.EMPLOYEE_USER_LINKED,
                Map.of(),
                Map.of("userId", user.getId()),
                null,
                null,
                actor
            );
            EmployeeBranch accountBranch = primaryBranch(employeeId);
            notificationEventPublisher.publish(new EmployeeAccountLinkedEvent(
                employee.getId(),
                employee.getFullName(),
                accountBranch.getBranch().getId(),
                user.getId(),
                actor.getId(),
                employee.getVersion()
            ));
        }
        return detail(employee);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_ACCOUNT_UNLINK)")
    @Transactional
    public EmployeeDtos.DetailResponse unlinkAccount(
        Long employeeId,
        EmployeeDtos.VersionRequest request
    ) {
        Employee employee = employeeForUpdate(employeeId, request.version());
        if (employee.getLinkedUser() == null) {
            throw new ApiException(
                HttpStatus.CONFLICT,
                ErrorCode.EMPLOYEE_ACCOUNT_NOT_LINKED,
                "Employee account is not linked",
                "This employee does not have a linked user account."
            );
        }
        Long userId = employee.getLinkedUser().getId();
        UserAccount actor = actor();
        employee.unlinkUser(actor);
        employeeRepository.flush();
        auditService.record(
            employee,
            EmployeeAuditAction.EMPLOYEE_USER_UNLINKED,
            Map.of("userId", userId),
            Map.of(),
            null,
            null,
            actor
        );
        return detail(employee);
    }

    private Employee employeeForUpdate(Long employeeId, Long requestedVersion) {
        Employee employee = employeeRepository.findDetailByIdForUpdate(employeeId)
            .orElseThrow(authorizationService::employeeNotFound);
        authorizationService.requireEmployeeScope(employee);
        if (requestedVersion == null || employee.getVersion() != requestedVersion) {
            throw new ApiException(
                HttpStatus.CONFLICT,
                ErrorCode.EMPLOYEE_VERSION_CONFLICT,
                "Employee version conflict",
                "This employee record was updated by another user. Reload before saving again."
            );
        }
        return employee;
    }

    private EmployeePosition activePosition(Long positionId) {
        return positionRepository.findById(positionId)
            .filter(EmployeePosition::isActive)
            .orElseThrow(() -> new ApiException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                ErrorCode.EMPLOYEE_POSITION_INACTIVE,
                "Employee position unavailable",
                "The selected employee position does not exist or is inactive."
            ));
    }

    private List<Branch> activeBranches(Set<Long> branchIds) {
        Map<Long, Branch> branches = new LinkedHashMap<>();
        branchRepository.findAllById(branchIds).forEach(branch -> branches.put(branch.getId(), branch));
        if (branches.size() != branchIds.size()
            || branches.values().stream().anyMatch(branch -> branch.getStatus() != AccountStatus.ACTIVE)) {
            throw new ApiException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                ErrorCode.EMPLOYEE_BRANCH_NOT_FOUND,
                "Employee branch unavailable",
                "One or more selected branches do not exist or are inactive."
            );
        }
        return branchIds.stream().map(branches::get).toList();
    }

    private UserAccount linkableUser(Long userId, Long employeeId) {
        UserAccount user = userRepository.findByIdForUpdate(userId).orElseThrow(this::userNotFound);
        authorizationService.requireUserScope(user);
        boolean linkedElsewhere = employeeId == null
            ? employeeRepository.existsByLinkedUserId(userId)
            : employeeRepository.existsByLinkedUserIdAndIdNot(userId, employeeId);
        if (linkedElsewhere) {
            throw accountAlreadyLinked();
        }
        return user;
    }

    private Set<Long> uniqueBranchIds(List<Long> branchIds) {
        Set<Long> unique = new LinkedHashSet<>(branchIds);
        if (unique.size() != branchIds.size()) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                ErrorCode.EMPLOYEE_BRANCH_DUPLICATE,
                "Duplicate employee branch",
                "Each employee branch may only be selected once."
            );
        }
        return unique;
    }

    private void validateInitialStatus(EmployeeStatus status) {
        if (status != EmployeeStatus.ACTIVE && status != EmployeeStatus.INACTIVE) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                ErrorCode.EMPLOYEE_INVALID_STATUS_TRANSITION,
                "Invalid initial employee status",
                "New employees may start as ACTIVE or INACTIVE."
            );
        }
    }

    private void validateAddress(EmployeeDtos.CreateRequest request) {
        AdministrativeAddressValidator.validate(
            request.administrativeVersion(),
            request.province(),
            request.provinceCode(),
            request.district(),
            request.districtCode(),
            request.ward(),
            request.wardCode()
        );
    }

    private void validateAddress(EmployeeDtos.UpdateRequest request) {
        AdministrativeAddressValidator.validate(
            request.administrativeVersion(),
            request.province(),
            request.provinceCode(),
            request.district(),
            request.districtCode(),
            request.ward(),
            request.wardCode()
        );
    }

    private void requireValidTransition(EmployeeStatus from, EmployeeStatus to) {
        boolean valid = switch (from) {
            case ACTIVE -> to == EmployeeStatus.INACTIVE
                || to == EmployeeStatus.SUSPENDED
                || to == EmployeeStatus.TERMINATED;
            case INACTIVE -> to == EmployeeStatus.ACTIVE
                || to == EmployeeStatus.SUSPENDED
                || to == EmployeeStatus.TERMINATED;
            case SUSPENDED -> to == EmployeeStatus.ACTIVE
                || to == EmployeeStatus.INACTIVE
                || to == EmployeeStatus.TERMINATED;
            case TERMINATED -> false;
        };
        if (!valid) {
            throw new ApiException(
                HttpStatus.CONFLICT,
                ErrorCode.EMPLOYEE_INVALID_STATUS_TRANSITION,
                "Invalid employee status transition",
                "The requested employee status transition is not allowed."
            );
        }
    }

    private List<String> changedProfileFields(
        Employee employee,
        EmployeeDtos.UpdateRequest request,
        EmployeeDataNormalizer.NormalizedPhone phone
    ) {
        List<String> fields = new ArrayList<>();
        addChanged(fields, "fullName", employee.getFullName(), normalizer.meaningfulName(request.fullName()));
        addChanged(fields, "phone", employee.getNormalizedPhone(), phone.normalized());
        addChanged(fields, "email", employee.getEmail(), normalizer.email(request.email()));
        addChanged(fields, "birthDate", employee.getBirthDate(), request.birthDate());
        addChanged(fields, "address", employee.getAddress(), normalizer.optionalText(request.address()));
        addChanged(fields, "administrativeVersion", employee.getAdministrativeVersion(), request.administrativeVersion());
        addChanged(fields, "province", employee.getProvince(), normalizer.optionalText(request.province()));
        addChanged(fields, "provinceCode", employee.getProvinceCode(), request.provinceCode());
        addChanged(fields, "district", employee.getDistrict(), normalizer.optionalText(request.district()));
        addChanged(fields, "districtCode", employee.getDistrictCode(), request.districtCode());
        addChanged(fields, "ward", employee.getWard(), normalizer.optionalText(request.ward()));
        addChanged(fields, "wardCode", employee.getWardCode(), request.wardCode());
        addChanged(fields, "hireDate", employee.getHireDate(), request.hireDate());
        return fields;
    }

    private void addChanged(List<String> fields, String field, Object oldValue, Object newValue) {
        if (!Objects.equals(oldValue, newValue)) {
            fields.add(field);
        }
    }

    private Map<String, Object> creationMetadata(Employee employee, Set<Long> branchIds) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("fields", List.of(
            "fullName", "phone", "email", "birthDate", "address", "administrativeVersion",
            "province", "provinceCode", "district", "districtCode", "ward", "wardCode", "hireDate"
        ));
        metadata.put("status", employee.getStatus().name());
        metadata.put("positionId", employee.getPosition().getId());
        metadata.put("branchIds", branchIds);
        if (employee.getLinkedUser() != null) {
            metadata.put("userId", employee.getLinkedUser().getId());
        }
        return metadata;
    }

    private List<EmployeeBranch> sortAssignments(List<EmployeeBranch> assignments) {
        return assignments.stream()
            .sorted((left, right) -> {
                int primaryOrder = Boolean.compare(right.isPrimary(), left.isPrimary());
                return primaryOrder != 0
                    ? primaryOrder
                    : left.getAssignedAt().compareTo(right.getAssignedAt());
            })
            .toList();
    }

    private EmployeeDtos.DetailResponse detail(Employee employee) {
        return mapper.toDetail(employee, employeeBranchRepository.findActiveByEmployeeId(employee.getId()));
    }

    private EmployeeBranch primaryBranch(Long employeeId) {
        List<EmployeeBranch> activeBranches = employeeBranchRepository.findActiveByEmployeeId(employeeId);
        return activeBranches.stream()
            .filter(EmployeeBranch::isPrimary)
            .findFirst()
            .orElseGet(() -> activeBranches.stream()
                .findFirst()
                .orElseThrow(this::branchAssignmentNotFound));
    }

    private UserAccount actor() {
        return userRepository.getReferenceById(authorizationService.currentUser().id());
    }

    private ApiException primaryBranchRequired() {
        return new ApiException(
            HttpStatus.CONFLICT,
            ErrorCode.EMPLOYEE_PRIMARY_BRANCH_REQUIRED,
            "Primary employee branch required",
            "Select exactly one active primary branch before continuing."
        );
    }

    private ApiException branchAssignmentNotFound() {
        return new ApiException(
            HttpStatus.NOT_FOUND,
            ErrorCode.EMPLOYEE_BRANCH_NOT_FOUND,
            "Employee branch not found",
            "The employee does not have an active assignment to this branch."
        );
    }

    private ApiException accountAlreadyLinked() {
        return new ApiException(
            HttpStatus.CONFLICT,
            ErrorCode.EMPLOYEE_ACCOUNT_ALREADY_LINKED,
            "User account already linked",
            "The employee or selected user account is already linked."
        );
    }

    private ApiException userNotFound() {
        return new ApiException(
            HttpStatus.NOT_FOUND,
            ErrorCode.USER_ACCOUNT_NOT_FOUND,
            "User account not found",
            "The selected user account does not exist."
        );
    }

    private RuntimeException translateIntegrityViolation(DataIntegrityViolationException exception) {
        String message = fullMessage(exception).toLowerCase();
        if (message.contains("uk_employees_linked_user")) {
            return accountAlreadyLinked();
        }
        if (message.contains("uk_employee_branches_active") || message.contains("uk_employee_primary_branch")) {
            return new ApiException(
                HttpStatus.CONFLICT,
                ErrorCode.EMPLOYEE_BRANCH_DUPLICATE,
                "Employee branch conflict",
                "The employee branch assignment changed concurrently. Reload and try again."
            );
        }
        return exception;
    }

    private String fullMessage(Throwable throwable) {
        StringBuilder result = new StringBuilder();
        Throwable current = throwable;
        while (current != null) {
            if (current.getMessage() != null) {
                result.append(' ').append(current.getMessage());
            }
            current = current.getCause();
        }
        return result.toString();
    }
}
