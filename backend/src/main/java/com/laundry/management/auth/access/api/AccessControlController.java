package com.laundry.management.auth.access.api;

import com.laundry.management.auth.access.application.AccessControlService;
import com.laundry.management.auth.domain.AccountStatus;
import com.laundry.management.auth.domain.PermissionRiskLevel;
import com.laundry.management.auth.domain.PermissionStatus;
import com.laundry.management.auth.domain.RoleStatus;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/access")
public class AccessControlController {

    private final AccessControlService service;

    public AccessControlController(AccessControlService service) {
        this.service = service;
    }

    @GetMapping("/permissions")
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ACCESS_PERMISSION_READ)")
    public AccessDtos.PageResponse<AccessDtos.PermissionResponse> permissions(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String module,
        @RequestParam(required = false) PermissionRiskLevel riskLevel,
        @RequestParam(required = false) PermissionStatus status,
        @RequestParam(required = false) String sort
    ) {
        return service.permissions(page, size, search, module, riskLevel, status, sort);
    }

    @GetMapping("/permissions/grouped")
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ACCESS_PERMISSION_READ)")
    public List<AccessDtos.PermissionModuleResponse> groupedPermissions() {
        return service.groupedPermissions();
    }

    @GetMapping("/roles")
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ACCESS_ROLE_READ)")
    public AccessDtos.PageResponse<AccessDtos.RoleResponse> roles(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) RoleStatus status,
        @RequestParam(required = false) Boolean system,
        @RequestParam(required = false) String sort
    ) {
        return service.roles(page, size, search, status, system, sort);
    }

    @GetMapping("/roles/{roleId}")
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ACCESS_ROLE_READ)")
    public AccessDtos.RoleResponse role(@PathVariable Long roleId) {
        return service.role(roleId);
    }

    @PostMapping("/roles")
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ACCESS_ROLE_CREATE)")
    public AccessDtos.RoleResponse createRole(@Valid @RequestBody AccessDtos.CreateRoleRequest request) {
        return service.createRole(request);
    }

    @PutMapping("/roles/{roleId}")
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ACCESS_ROLE_UPDATE)")
    public AccessDtos.RoleResponse updateRole(
        @PathVariable Long roleId,
        @Valid @RequestBody AccessDtos.UpdateRoleRequest request
    ) {
        return service.updateRole(roleId, request);
    }

    @PatchMapping("/roles/{roleId}/status")
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ACCESS_ROLE_DEACTIVATE)")
    public AccessDtos.RoleResponse changeRoleStatus(
        @PathVariable Long roleId,
        @Valid @RequestBody AccessDtos.RoleStatusRequest request
    ) {
        return service.changeRoleStatus(roleId, request);
    }

    @PostMapping("/roles/{roleId}/clone")
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ACCESS_ROLE_CLONE)")
    public AccessDtos.RoleResponse cloneRole(
        @PathVariable Long roleId,
        @Valid @RequestBody AccessDtos.CloneRoleRequest request
    ) {
        return service.cloneRole(roleId, request);
    }

    @GetMapping("/roles/{roleId}/permissions")
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ACCESS_ROLE_READ)")
    public AccessDtos.RoleMatrixResponse roleMatrix(@PathVariable Long roleId) {
        return service.roleMatrix(roleId);
    }

    @PutMapping("/roles/{roleId}/permissions")
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ACCESS_ROLE_PERMISSION_ASSIGN)")
    public AccessDtos.RoleMatrixResponse updateRoleMatrix(
        @PathVariable Long roleId,
        @Valid @RequestBody AccessDtos.RoleMatrixRequest request
    ) {
        return service.updateRoleMatrix(roleId, request);
    }

    @GetMapping("/users")
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ACCESS_USER_READ)")
    public AccessDtos.PageResponse<AccessDtos.UserSummaryResponse> users(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) Long roleId,
        @RequestParam(required = false) AccountStatus status,
        @RequestParam(required = false) Long branchId,
        @RequestParam(required = false) Boolean hasOverrides,
        @RequestParam(required = false) String sort
    ) {
        return service.users(page, size, search, roleId, status, branchId, hasOverrides, sort);
    }

    @GetMapping("/users/{userId}")
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ACCESS_USER_READ)")
    public AccessDtos.UserAccessResponse userAccess(@PathVariable Long userId) {
        return service.userAccess(userId);
    }

    @PutMapping("/users/{userId}/role")
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ACCESS_USER_ROLE_ASSIGN)")
    public AccessDtos.UserAccessResponse assignRole(
        @PathVariable Long userId,
        @Valid @RequestBody AccessDtos.UserRoleRequest request
    ) {
        return service.assignRole(userId, request);
    }

    @PutMapping("/users/{userId}/overrides")
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ACCESS_USER_PERMISSION_OVERRIDE)")
    public AccessDtos.UserAccessResponse replaceOverrides(
        @PathVariable Long userId,
        @Valid @RequestBody AccessDtos.OverridesRequest request
    ) {
        return service.replaceOverrides(userId, request);
    }

    @GetMapping("/users/{userId}/effective")
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ACCESS_EFFECTIVE_PERMISSION_READ)")
    public AccessDtos.EffectiveAccessResponse effectivePermissions(@PathVariable Long userId) {
        return service.effectiveAccess(userId);
    }

    @GetMapping("/audit")
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ACCESS_AUDIT_READ)")
    public AccessDtos.PageResponse<AccessDtos.AuditResponse> audit(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String targetType,
        @RequestParam(required = false) Long targetId,
        @RequestParam(required = false) String action,
        @RequestParam(required = false) String permissionCode,
        @RequestParam(required = false) String sort
    ) {
        return service.audit(page, size, targetType, targetId, action, permissionCode, sort);
    }
}
