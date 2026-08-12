package com.laundry.management.auth.access.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.auth.access.api.AccessDtos;
import com.laundry.management.auth.domain.AccountStatus;
import com.laundry.management.auth.domain.AuthorizationAuditLog;
import com.laundry.management.auth.domain.Permission;
import com.laundry.management.auth.domain.PermissionModule;
import com.laundry.management.auth.domain.PermissionRiskLevel;
import com.laundry.management.auth.domain.PermissionStatus;
import com.laundry.management.auth.domain.Role;
import com.laundry.management.auth.domain.RoleCodeSequence;
import com.laundry.management.auth.domain.RoleStatus;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.domain.UserPermissionOverride;
import com.laundry.management.auth.infrastructure.AuthorizationAuditRepository;
import com.laundry.management.auth.infrastructure.PermissionRepository;
import com.laundry.management.auth.infrastructure.PermissionModuleRepository;
import com.laundry.management.auth.infrastructure.RoleRepository;
import com.laundry.management.auth.infrastructure.RoleCodeSequenceRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.auth.security.BranchAccess;
import com.laundry.management.auth.security.CurrentUser;
import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccessControlService {

    private static final int MAX_PAGE_SIZE = 100;

    private final PermissionRepository permissionRepository;
    private final PermissionModuleRepository permissionModuleRepository;
    private final RoleRepository roleRepository;
    private final RoleCodeSequenceRepository roleCodeSequenceRepository;
    private final UserAccountRepository userRepository;
    private final AuthorizationAuditRepository auditRepository;
    private final EffectivePermissionService effectivePermissionService;
    private final CurrentUserProvider currentUserProvider;
    private final ObjectMapper objectMapper;

    public AccessControlService(
        PermissionRepository permissionRepository,
        PermissionModuleRepository permissionModuleRepository,
        RoleRepository roleRepository,
        RoleCodeSequenceRepository roleCodeSequenceRepository,
        UserAccountRepository userRepository,
        AuthorizationAuditRepository auditRepository,
        EffectivePermissionService effectivePermissionService,
        CurrentUserProvider currentUserProvider,
        ObjectMapper objectMapper
    ) {
        this.permissionRepository = permissionRepository;
        this.permissionModuleRepository = permissionModuleRepository;
        this.roleRepository = roleRepository;
        this.roleCodeSequenceRepository = roleCodeSequenceRepository;
        this.userRepository = userRepository;
        this.auditRepository = auditRepository;
        this.effectivePermissionService = effectivePermissionService;
        this.currentUserProvider = currentUserProvider;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public AccessDtos.PageResponse<AccessDtos.PermissionResponse> permissions(
        int page,
        int size,
        String search,
        String module,
        PermissionRiskLevel riskLevel,
        PermissionStatus status,
        String sort
    ) {
        PageRequest pageable = pageRequest(page, size, sort, Map.of(
            "code", "code", "module", "module", "displayOrder", "displayOrder", "riskLevel", "riskLevel"
        ), Sort.by("module").ascending().and(Sort.by("displayOrder")).and(Sort.by("code")));
        Page<Permission> result = permissionRepository.search(
            like(search), blankToNull(module), riskLevel, status, pageable
        );
        return page(result.map(this::permission));
    }

    @Transactional(readOnly = true)
    public List<AccessDtos.PermissionModuleResponse> groupedPermissions() {
        return group(
            permissionRepository.findAllByOrderByModuleAscDisplayOrderAscCodeAsc(),
            permissionModuleRepository.findAllByStatusOrderByDisplayOrderAscCodeAsc(PermissionStatus.ACTIVE)
        );
    }

    @Transactional(readOnly = true)
    public AccessDtos.CurrentUserResponse currentUser() {
        CurrentUser current = currentUserProvider.getRequired();
        UserAccount account = userRepository.findAccessById(current.id()).orElseThrow(() -> new ApiException(
            HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED, "Authentication required", "Sign in to continue."
        ));
        EffectivePermissionService.EffectiveAccess access = effectivePermissionService.resolve(account);
        Role primaryRole = access.primaryRole();
        return new AccessDtos.CurrentUserResponse(
            account.getId(),
            account.getUsername(),
            account.getDisplayName(),
            account.getStatus(),
            primaryRole == null ? null : roleSummary(primaryRole),
            access.permissionCodes(),
            account.getBranchAssignments().stream()
                .map(item -> new BranchAccess(
                    item.getBranch().getId(), item.getBranch().getCode(), item.getBranch().getName()
                ))
                .sorted(Comparator.comparing(BranchAccess::code))
                .toList(),
            account.getDefaultBranch() == null ? null : account.getDefaultBranch().getId(),
            account.getAuthorizationVersion()
        );
    }

    @Transactional(readOnly = true)
    public AccessDtos.PageResponse<AccessDtos.RoleResponse> roles(
        int page,
        int size,
        String search,
        RoleStatus status,
        Boolean system,
        String sort
    ) {
        PageRequest pageable = pageRequest(page, size, sort, Map.of(
            "code", "code", "displayName", "displayName", "nameVi", "nameVi",
            "status", "status", "updatedAt", "updatedAt"
        ), Sort.by(Sort.Order.asc("displayName"), Sort.Order.asc("id")));
        Page<Role> result = roleRepository.search(like(search), status, system, pageable);
        Map<Long, Long> counts = assignedUserCounts(result.getContent().stream().map(Role::getId).toList());
        return new AccessDtos.PageResponse<>(
            result.getContent().stream().map(role -> role(role, counts.getOrDefault(role.getId(), 0L))).toList(),
            result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public AccessDtos.RoleResponse role(Long roleId) {
        Role role = requiredRole(roleId);
        return role(role, userRepository.countByRolesId(roleId));
    }

    @Transactional
    public AccessDtos.RoleResponse createRole(AccessDtos.CreateRoleRequest request) {
        CurrentUser current = currentUserProvider.getRequired();
        Role source = null;
        if (request.copyPermissionsFromRoleId() != null) {
            if (!current.permissions().contains(PermissionCodes.ACCESS_ROLE_READ)) {
                throw forbidden(ErrorCode.ACCESS_CONTROL_SCOPE_DENIED,
                    "Role read permission is required to copy an existing permission set.");
            }
            source = requiredRole(request.copyPermissionsFromRoleId());
            if (source.getStatus() != RoleStatus.ACTIVE) {
                throw conflict(ErrorCode.ROLE_INACTIVE, "Permissions cannot be copied from an inactive role.");
            }
        }
        UserAccount actor = requiredActor(current);
        Role role = new Role(nextRoleCode(), request.displayName().trim(), trim(request.description()), actor);
        if (source != null) role.replacePermissions(source.getPermissions());
        role = roleRepository.saveAndFlush(role);
        audit("ROLE", role.getId(), "ROLE_CREATED", null,
            source == null ? null : source.getCode(), json(roleMetadata(role)), "Role created");
        return role(role, 0);
    }

    @Transactional
    public AccessDtos.RoleResponse updateRole(Long roleId, AccessDtos.UpdateRoleRequest request) {
        Role role = requiredRole(roleId);
        requireVersion(role.getVersion(), request.version(), ErrorCode.ROLE_VERSION_CONFLICT);
        if (role.isSystem()) {
            throw forbidden(ErrorCode.SYSTEM_ROLE_PROTECTED, "System role metadata is managed by the application.");
        }
        CurrentUser current = currentUserProvider.getRequired();
        boolean statusChanged = role.getStatus() != request.status();
        if (statusChanged && !current.permissions().contains(PermissionCodes.ACCESS_ROLE_DEACTIVATE)) {
            throw forbidden(ErrorCode.FORBIDDEN, "Role status changes require the deactivate-role permission.");
        }
        Map<String, Object> previous = roleMetadata(role);
        UserAccount actor = requiredActor(current);
        role.updateCustomMetadata(request.displayName().trim(), trim(request.description()), actor);
        if (statusChanged) role.changeStatus(request.status(), actor);
        roleRepository.flush();
        audit("ROLE", roleId, "ROLE_UPDATED", null, json(previous), json(roleMetadata(role)), "Role metadata updated");
        if (statusChanged) {
            userRepository.incrementAuthorizationVersionByRoleId(roleId);
            audit("ROLE", roleId, "ROLE_STATUS_CHANGED", null,
                String.valueOf(previous.get("status")), request.status().name(), "Role status updated");
        }
        return role(role, userRepository.countByRolesId(roleId));
    }

    @Transactional
    public AccessDtos.RoleResponse changeRoleStatus(Long roleId, AccessDtos.RoleStatusRequest request) {
        Role role = requiredRole(roleId);
        requireVersion(role.getVersion(), request.version(), ErrorCode.ROLE_VERSION_CONFLICT);
        if (role.isSystem()) throw forbidden(ErrorCode.SYSTEM_ROLE_PROTECTED, "System roles cannot be deactivated.");
        RoleStatus previous = role.getStatus();
        role.changeStatus(request.status(), requiredActor(currentUserProvider.getRequired()));
        roleRepository.flush();
        userRepository.incrementAuthorizationVersionByRoleId(roleId);
        audit("ROLE", roleId, "ROLE_STATUS_CHANGED", null, previous.name(), request.status().name(), request.reason());
        return role(role, userRepository.countByRolesId(roleId));
    }

    @Transactional
    public AccessDtos.RoleResponse cloneRole(Long roleId, AccessDtos.CloneRoleRequest request) {
        Role source = requiredRole(roleId);
        UserAccount actor = requiredActor(currentUserProvider.getRequired());
        Role clone = new Role(nextRoleCode(), request.displayName().trim(), trim(request.description()), actor);
        if (request.copyPermissions()) clone.replacePermissions(source.getPermissions());
        clone = roleRepository.saveAndFlush(clone);
        audit("ROLE", clone.getId(), "ROLE_CLONED", null, source.getCode(), json(roleMetadata(clone)), request.reason());
        return role(clone, 0);
    }

    @Transactional(readOnly = true)
    public AccessDtos.RoleMatrixResponse roleMatrix(Long roleId) {
        Role role = requiredRole(roleId);
        long assigned = userRepository.countByRolesId(roleId);
        Set<String> codes = role.getPermissions().stream().map(Permission::getCode)
            .collect(Collectors.toCollection(LinkedHashSet::new));
        int highRisk = (int) role.getPermissions().stream()
            .filter(permission -> permission.getRiskLevel() == PermissionRiskLevel.HIGH
                || permission.getRiskLevel() == PermissionRiskLevel.CRITICAL)
            .count();
        return new AccessDtos.RoleMatrixResponse(
            role(role, assigned), codes, groupedPermissions(), role.getVersion(), assigned, highRisk
        );
    }

    @Transactional
    public AccessDtos.RoleMatrixResponse updateRoleMatrix(Long roleId, AccessDtos.RoleMatrixRequest request) {
        Role role = requiredRole(roleId);
        requireVersion(role.getVersion(), request.version(), ErrorCode.ROLE_PERMISSION_VERSION_CONFLICT);
        Set<Permission> permissions = validatePermissions(request.permissionCodes());
        CurrentUser actor = currentUserProvider.getRequired();
        boolean actorUsesRole = actor.roles().contains(role.getCode());
        if (actorUsesRole && !request.permissionCodes().contains(PermissionCodes.ACCESS_ROLE_PERMISSION_ASSIGN)) {
            throw forbidden(ErrorCode.SELF_LOCKOUT_PREVENTED, "You cannot remove your own permission-matrix access.");
        }
        Set<String> oldCodes = role.getPermissions().stream().map(Permission::getCode).collect(Collectors.toSet());
        role.replacePermissions(permissions);
        role.markUpdatedBy(requiredActor(actor));
        roleRepository.flush();
        userRepository.incrementAuthorizationVersionByRoleId(roleId);
        audit("ROLE", roleId, "ROLE_PERMISSIONS_CHANGED", null, json(oldCodes), json(request.permissionCodes()), request.reason());
        return roleMatrix(roleId);
    }

    @Transactional(readOnly = true)
    public AccessDtos.PageResponse<AccessDtos.UserSummaryResponse> users(
        int page,
        int size,
        String search,
        Long roleId,
        AccountStatus status,
        Long branchId,
        Boolean hasOverrides,
        String sort
    ) {
        CurrentUser current = currentUserProvider.getRequired();
        if (branchId != null && !current.canAccessBranch(branchId)) {
            throw forbidden(ErrorCode.ACCESS_CONTROL_SCOPE_DENIED, "The selected branch is outside your access scope.");
        }
        PageRequest pageable = pageRequest(page, size, sort, Map.of(
            "username", "username", "displayName", "displayName", "status", "status", "updatedAt", "updatedAt"
        ), Sort.by(Sort.Order.asc("displayName"), Sort.Order.asc("id")));
        Page<UserAccount> result = userRepository.searchAccessUsers(
            like(search), roleId, status, branchId, hasOverrides, current.branchIds(), pageable
        );
        return page(result.map(this::userSummary));
    }

    @Transactional(readOnly = true)
    public AccessDtos.UserAccessResponse userAccess(Long userId) {
        UserAccount user = scopedUser(userId);
        EffectivePermissionService.EffectiveAccess access = effectivePermissionService.resolve(user);
        Set<String> rolePermissions = access.primaryRole() == null ? Set.of()
            : access.primaryRole().getPermissions().stream().map(Permission::getCode).collect(Collectors.toSet());
        return new AccessDtos.UserAccessResponse(
            userSummary(user),
            rolePermissions,
            user.getPermissionOverrides().stream()
                .sorted(Comparator.comparing(item -> item.getPermission().getCode()))
                .map(this::override)
                .toList(),
            access.permissionCodes(),
            decisions(access),
            user.getAuthorizationVersion(),
            user.getAccessVersion()
        );
    }

    @Transactional(readOnly = true)
    public AccessDtos.EffectiveAccessResponse effectiveAccess(Long userId) {
        UserAccount user = scopedUser(userId);
        EffectivePermissionService.EffectiveAccess access = effectivePermissionService.resolve(user);
        return new AccessDtos.EffectiveAccessResponse(
            userSummary(user),
            access.permissionCodes(),
            decisions(access),
            user.getAuthorizationVersion()
        );
    }

    @Transactional
    public AccessDtos.UserAccessResponse assignRole(Long userId, AccessDtos.UserRoleRequest request) {
        UserAccount target = scopedUser(userId);
        requireVersion(target.getAccessVersion(), request.version(), ErrorCode.USER_ROLE_VERSION_CONFLICT);
        Role role = requiredRole(request.roleId());
        if (role.getStatus() != RoleStatus.ACTIVE) throw conflict(ErrorCode.ROLE_INACTIVE, "Inactive roles cannot be assigned.");
        CurrentUser actor = currentUserProvider.getRequired();
        if (actor.id().equals(userId)
            && !role.getPermissions().stream().map(Permission::getCode).collect(Collectors.toSet())
                .contains(PermissionCodes.ACCESS_USER_ROLE_ASSIGN)) {
            throw forbidden(ErrorCode.SELF_LOCKOUT_PREVENTED, "You cannot remove your own role-assignment access.");
        }
        String previous = target.getRoles().stream().map(Role::getCode).sorted().findFirst().orElse(null);
        target.assignPrimaryRole(role);
        userRepository.flush();
        audit("USER", userId, "USER_ROLE_CHANGED", null, previous, role.getCode(), request.reason());
        return userAccess(userId);
    }

    @Transactional
    public AccessDtos.UserAccessResponse replaceOverrides(Long userId, AccessDtos.OverridesRequest request) {
        UserAccount target = scopedUser(userId);
        requireVersion(target.getAccessVersion(), request.version(), ErrorCode.USER_OVERRIDE_VERSION_CONFLICT);
        Set<String> codes = request.overrides().stream().map(AccessDtos.OverrideItemRequest::permissionCode)
            .collect(Collectors.toSet());
        if (codes.size() != request.overrides().size()) {
            throw conflict(ErrorCode.USER_OVERRIDE_DUPLICATE, "Each permission may have only one override.");
        }
        Map<String, Permission> permissions = validatePermissions(codes).stream()
            .collect(Collectors.toMap(Permission::getCode, Function.identity()));
        Map<String, UserPermissionOverride> existing = target.getPermissionOverrides().stream()
            .collect(Collectors.toMap(item -> item.getPermission().getCode(), Function.identity()));
        List<UserPermissionOverride> overrides = new ArrayList<>();
        for (AccessDtos.OverrideItemRequest item : request.overrides()) {
            if (item.effectiveFrom() != null && item.effectiveTo() != null
                && !item.effectiveTo().isAfter(item.effectiveFrom())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_OVERRIDE_PERIOD,
                    "Invalid override period", "Effective-to must be after effective-from.");
            }
            UserPermissionOverride override = existing.get(item.permissionCode());
            if (override == null) {
                override = new UserPermissionOverride(
                    target, permissions.get(item.permissionCode()), item.effect(), item.reason().trim(),
                    item.effectiveFrom(), item.effectiveTo()
                );
            } else {
                override.update(item.effect(), item.reason().trim(), item.effectiveFrom(), item.effectiveTo());
            }
            overrides.add(override);
        }
        CurrentUser actor = currentUserProvider.getRequired();
        if (actor.id().equals(userId)) {
            boolean deniesOverrideAdmin = overrides.stream().anyMatch(item ->
                item.getPermission().getCode().equals(PermissionCodes.ACCESS_USER_PERMISSION_OVERRIDE)
                    && item.getEffect() == com.laundry.management.auth.domain.PermissionOverrideEffect.DENY);
            if (deniesOverrideAdmin) {
                throw forbidden(ErrorCode.SELF_LOCKOUT_PREVENTED, "You cannot deny your own override-management access.");
            }
        }
        String previous = json(target.getPermissionOverrides().stream()
            .map(item -> item.getPermission().getCode() + ":" + item.getEffect()).sorted().toList());
        target.replacePermissionOverrides(new LinkedHashSet<>(overrides));
        userRepository.flush();
        audit("USER", userId, "USER_OVERRIDES_CHANGED", null, previous,
            json(overrides.stream().map(item -> item.getPermission().getCode() + ":" + item.getEffect()).toList()),
            "Complete override set updated");
        return userAccess(userId);
    }

    @Transactional(readOnly = true)
    public AccessDtos.PageResponse<AccessDtos.AuditResponse> audit(
        int page,
        int size,
        String targetType,
        Long targetId,
        String action,
        String permissionCode,
        String sort
    ) {
        PageRequest pageable = pageRequest(page, size, sort, Map.of(
            "createdAt", "createdAt", "action", "action", "targetType", "targetType"
        ), Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        return page(auditRepository.search(
            blankToNull(targetType), targetId, blankToNull(action), blankToNull(permissionCode), pageable
        ).map(this::audit));
    }

    private UserAccount scopedUser(Long userId) {
        UserAccount target = userRepository.findAccessById(userId).orElseThrow(() -> new ApiException(
            HttpStatus.NOT_FOUND, ErrorCode.USER_ACCESS_NOT_FOUND, "User access not found",
            "The user does not exist or is outside your access scope."
        ));
        Set<Long> allowed = Set.copyOf(currentUserProvider.getRequired().branchIds());
        boolean overlaps = target.getBranchAssignments().stream()
            .anyMatch(assignment -> allowed.contains(assignment.getBranch().getId()));
        if (!overlaps) throw forbidden(ErrorCode.ACCESS_CONTROL_SCOPE_DENIED, "The user is outside your branch scope.");
        return target;
    }

    private UserAccount requiredActor(CurrentUser current) {
        return userRepository.findById(current.id()).orElseThrow(() -> new ApiException(
            HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED, "Authentication required",
            "The authenticated user no longer exists."
        ));
    }

    private Role requiredRole(Long roleId) {
        return roleRepository.findDetailById(roleId).orElseThrow(() -> new ApiException(
            HttpStatus.NOT_FOUND, ErrorCode.ROLE_NOT_FOUND, "Role not found", "The role does not exist."
        ));
    }

    private Set<Permission> validatePermissions(Collection<String> codes) {
        List<Permission> found = permissionRepository.findAllByCodeIn(codes);
        Set<String> foundCodes = found.stream().map(Permission::getCode).collect(Collectors.toSet());
        if (foundCodes.size() != codes.size() || !foundCodes.containsAll(codes)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_PERMISSION_CODE,
                "Invalid permission code", "One or more permission codes are unknown.");
        }
        return new LinkedHashSet<>(found);
    }

    private List<AccessDtos.PermissionDecisionResponse> decisions(EffectivePermissionService.EffectiveAccess access) {
        Map<String, Permission> catalog = permissionRepository.findAllByOrderByModuleAscDisplayOrderAscCodeAsc()
            .stream().collect(Collectors.toMap(Permission::getCode, Function.identity()));
        Map<String, EffectivePermissionService.PermissionDecision> decisions = access.decisions().stream()
            .collect(Collectors.toMap(EffectivePermissionService.PermissionDecision::permissionCode, Function.identity()));
        return catalog.values().stream().map(permission -> {
            var decision = decisions.get(permission.getCode());
            return new AccessDtos.PermissionDecisionResponse(
                permission.getCode(), decision != null && decision.effective(),
                decision == null ? "NONE" : decision.source(),
                decision == null ? null : decision.roleCode(),
                decision != null && decision.overridesRole(),
                decision == null ? null : decision.reason(),
                decision == null ? null : decision.effectiveFrom(),
                decision == null ? null : decision.effectiveTo(),
                permission.getRiskLevel(), permission.getNameVi(), permission.getNameEn(), permission.getModule()
            );
        }).toList();
    }

    private AccessDtos.PermissionResponse permission(Permission permission) {
        return new AccessDtos.PermissionResponse(
            permission.getId(), permission.getCode(), permission.getModule(), permission.getResource(),
            permission.getAction(), permission.getNameVi(), permission.getNameEn(),
            permission.getDescriptionVi(), permission.getDescriptionEn(), permission.getRiskLevel(),
            permission.getDisplayOrder(), permission.getStatus()
        );
    }

    private List<AccessDtos.PermissionModuleResponse> group(
        List<Permission> permissions,
        List<PermissionModule> modules
    ) {
        Map<String, List<Permission>> grouped = permissions.stream()
            .filter(permission -> permission.getStatus() == PermissionStatus.ACTIVE)
            .collect(Collectors.groupingBy(Permission::getModule, LinkedHashMap::new, Collectors.toList()));
        return modules.stream()
            .filter(module -> grouped.containsKey(module.getCode()))
            .map(module -> new AccessDtos.PermissionModuleResponse(
                module.getCode(),
                module.getNameVi(),
                module.getNameEn(),
                module.getDisplayOrder(),
                grouped.get(module.getCode()).stream().map(this::permission).toList()
            ))
            .toList();
    }

    private AccessDtos.RoleResponse role(Role role, long assignedUsers) {
        return new AccessDtos.RoleResponse(
            role.getId(), role.getCode(), role.getDisplayName(), role.getBusinessDescription(),
            role.getNameVi(), role.getNameEn(), role.getDescriptionVi(), role.getDescriptionEn(),
            role.getStatus(), role.isSystem(), role.getVersion(), assignedUsers,
            role.getPermissions().size(), role.getCreatedAt(), role.getUpdatedAt(),
            userReference(role.getCreatedBy()), userReference(role.getUpdatedBy())
        );
    }

    private AccessDtos.UserSummaryResponse userSummary(UserAccount user) {
        Role primary = user.getRoles().stream().sorted(Comparator.comparing(Role::getId)).findFirst().orElse(null);
        List<BranchAccess> branches = user.getBranchAssignments().stream()
            .map(item -> new BranchAccess(item.getBranch().getId(), item.getBranch().getCode(), item.getBranch().getName()))
            .sorted(Comparator.comparing(BranchAccess::code)).toList();
        return new AccessDtos.UserSummaryResponse(
            user.getId(), user.getUsername(), user.getDisplayName(), user.getStatus(),
            primary == null ? null : roleSummary(primary), branches, user.getPermissionOverrides().size(),
            user.getAuthorizationVersion(), user.getAccessVersion(), user.getUpdatedAt()
        );
    }

    private AccessDtos.RoleSummary roleSummary(Role role) {
        return new AccessDtos.RoleSummary(
            role.getId(), role.getCode(), role.getDisplayName(), role.getNameVi(), role.getNameEn(),
            role.getStatus(), role.isSystem()
        );
    }

    private AccessDtos.OverrideResponse override(UserPermissionOverride override) {
        return new AccessDtos.OverrideResponse(
            override.getPermission().getCode(), override.getEffect(), override.getReason(),
            override.getEffectiveFrom(), override.getEffectiveTo(), override.getStatus(), override.getVersion()
        );
    }

    private AccessDtos.AuditResponse audit(AuthorizationAuditLog audit) {
        return new AccessDtos.AuditResponse(
            audit.getId(), audit.getActor().getId(), audit.getActor().getDisplayName(),
            audit.getTargetType(), audit.getTargetId(), audit.getAction(), audit.getPermissionCode(),
            audit.getOldValue(), audit.getNewValue(), audit.getReason(),
            audit.getBranch() == null ? null : new BranchAccess(
                audit.getBranch().getId(), audit.getBranch().getCode(), audit.getBranch().getName()
            ),
            audit.getCreatedAt()
        );
    }

    private void audit(
        String targetType,
        Long targetId,
        String action,
        String permissionCode,
        String oldValue,
        String newValue,
        String reason
    ) {
        CurrentUser actor = currentUserProvider.getRequired();
        UserAccount actorReference = userRepository.getReferenceById(actor.id());
        auditRepository.save(new AuthorizationAuditLog(
            actorReference, targetType, targetId, action, permissionCode,
            oldValue, newValue, trim(reason), null
        ));
    }

    private Map<Long, Long> assignedUserCounts(List<Long> roleIds) {
        if (roleIds.isEmpty()) return Map.of();
        return userRepository.countUsersByRoleIds(roleIds).stream()
            .collect(Collectors.toMap(row -> (Long) row[0], row -> (Long) row[1]));
    }

    private AccessDtos.UserReference userReference(UserAccount user) {
        return user == null ? null : new AccessDtos.UserReference(user.getId(), user.getDisplayName());
    }

    private Map<String, Object> roleMetadata(Role role) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("code", role.getCode());
        values.put("displayName", role.getDisplayName());
        values.put("description", role.getBusinessDescription());
        values.put("status", role.getStatus().name());
        values.put("system", role.isSystem());
        return values;
    }

    private String nextRoleCode() {
        while (true) {
            RoleCodeSequence allocation = roleCodeSequenceRepository.saveAndFlush(RoleCodeSequence.allocate());
            String code = "CUSTOM_ROLE_%06d".formatted(allocation.getId());
            if (!roleRepository.existsByCode(code)) return code;
        }
    }

    private <T> AccessDtos.PageResponse<T> page(Page<T> result) {
        return new AccessDtos.PageResponse<>(
            result.getContent(), result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages()
        );
    }

    private PageRequest pageRequest(
        int page,
        int size,
        String requestedSort,
        Map<String, String> allowedSorts,
        Sort fallback
    ) {
        if (page < 0 || size < 1) throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR,
            "Invalid pagination", "Page must not be negative and size must be positive.");
        if (size > MAX_PAGE_SIZE) throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.PAGE_SIZE_EXCEEDED,
            "Page size exceeded", "Page size must not exceed 100.");
        if (requestedSort == null || requestedSort.isBlank()) return PageRequest.of(page, size, fallback);
        String[] parts = requestedSort.split(",", -1);
        String property = allowedSorts.get(parts[0]);
        if (property == null || parts.length > 2) throw invalidSort();
        Sort.Direction direction;
        try {
            direction = parts.length == 1 || parts[1].isBlank()
                ? Sort.Direction.ASC : Sort.Direction.fromString(parts[1]);
        } catch (IllegalArgumentException exception) {
            throw invalidSort();
        }
        Sort sort = Sort.by(direction, property);
        if (!"id".equals(property)) sort = sort.and(Sort.by(Sort.Order.asc("id")));
        return PageRequest.of(page, size, sort);
    }

    private ApiException invalidSort() {
        return new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_SORT,
            "Invalid sort", "The requested sort field is not supported.");
    }

    private void requireVersion(long current, Long supplied, ErrorCode errorCode) {
        if (supplied == null || current != supplied) {
            throw conflict(errorCode, "This access configuration was changed. Reload the latest data.");
        }
    }

    private void requireReason(String reason) {
        if (reason == null || reason.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR,
                "Validation failed", "A reason is required for this access-control change.");
        }
    }

    private ApiException conflict(ErrorCode code, String detail) {
        return new ApiException(HttpStatus.CONFLICT, code, "Access configuration conflict", detail);
    }

    private ApiException forbidden(ErrorCode code, String detail) {
        return new ApiException(HttpStatus.FORBIDDEN, code, "Access denied", detail);
    }

    private String like(String value) {
        String trimmed = blankToNull(value);
        return trimmed == null ? null : "%" + trimmed.toLowerCase(Locale.ROOT)
            .replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String trim(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            return "[]";
        }
    }
}
