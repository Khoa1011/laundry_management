package com.laundry.management.auth.access.api;

import com.laundry.management.auth.domain.AccountStatus;
import com.laundry.management.auth.domain.OverrideStatus;
import com.laundry.management.auth.domain.PermissionOverrideEffect;
import com.laundry.management.auth.domain.PermissionRiskLevel;
import com.laundry.management.auth.domain.PermissionStatus;
import com.laundry.management.auth.domain.RoleStatus;
import com.laundry.management.auth.security.BranchAccess;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Set;

public final class AccessDtos {

    private AccessDtos() {
    }

    public record PageResponse<T>(
        List<T> items,
        int page,
        int size,
        long totalElements,
        int totalPages
    ) {
    }

    public record PermissionResponse(
        Long id,
        String code,
        String module,
        String resource,
        String action,
        String nameVi,
        String nameEn,
        String descriptionVi,
        String descriptionEn,
        PermissionRiskLevel riskLevel,
        int displayOrder,
        PermissionStatus status
    ) {
    }

    public record PermissionModuleResponse(
        String module,
        String nameVi,
        String nameEn,
        int displayOrder,
        List<PermissionResponse> permissions
    ) {
    }

    public record RoleResponse(
        Long id,
        String code,
        String displayName,
        String description,
        String nameVi,
        String nameEn,
        String descriptionVi,
        String descriptionEn,
        RoleStatus status,
        boolean system,
        long version,
        long assignedUsers,
        int permissionCount,
        Instant createdAt,
        Instant updatedAt,
        UserReference createdBy,
        UserReference updatedBy
    ) {
    }

    public record UserReference(Long id, String displayName) {
    }

    public record CreateRoleRequest(
        @NotBlank @Size(max = 150) String displayName,
        @Size(max = 1000) String description,
        Long copyPermissionsFromRoleId
    ) {
    }

    public record UpdateRoleRequest(
        @NotBlank @Size(max = 150) String displayName,
        @Size(max = 1000) String description,
        @NotNull RoleStatus status,
        @NotNull Long version
    ) {
    }

    public record RoleStatusRequest(
        @NotNull RoleStatus status,
        @NotNull Long version,
        @NotBlank @Size(max = 500) String reason
    ) {
    }

    public record CloneRoleRequest(
        @NotBlank @Size(max = 150) String displayName,
        @Size(max = 1000) String description,
        boolean copyPermissions,
        @NotBlank @Size(max = 500) String reason
    ) {
    }

    public record RoleMatrixResponse(
        RoleResponse role,
        Set<String> permissionCodes,
        List<PermissionModuleResponse> modules,
        long version,
        long assignedUserCount,
        int highRiskPermissionCount
    ) {
    }

    public record RoleMatrixRequest(
        @NotNull Set<@NotBlank String> permissionCodes,
        @NotNull Long version,
        @NotBlank @Size(max = 500) String reason
    ) {
    }

    public record UserSummaryResponse(
        Long id,
        String username,
        String displayName,
        AccountStatus status,
        RoleSummary primaryRole,
        List<BranchAccess> branches,
        int overrideCount,
        long authorizationVersion,
        long accessVersion,
        Instant updatedAt
    ) {
    }

    public record RoleSummary(
        Long id,
        String code,
        String displayName,
        String nameVi,
        String nameEn,
        RoleStatus status,
        boolean system
    ) {
    }

    public record OverrideResponse(
        String permissionCode,
        PermissionOverrideEffect effect,
        String reason,
        Instant effectiveFrom,
        Instant effectiveTo,
        OverrideStatus status,
        long version
    ) {
    }

    public record PermissionDecisionResponse(
        String permissionCode,
        boolean effective,
        String source,
        String roleCode,
        boolean overridesRole,
        String reason,
        Instant effectiveFrom,
        Instant effectiveTo,
        PermissionRiskLevel riskLevel,
        String nameVi,
        String nameEn,
        String module
    ) {
    }

    public record UserAccessResponse(
        UserSummaryResponse user,
        Set<String> rolePermissions,
        List<OverrideResponse> overrides,
        Set<String> effectivePermissions,
        List<PermissionDecisionResponse> decisions,
        long authorizationVersion,
        long version
    ) {
    }

    public record EffectiveAccessResponse(
        UserSummaryResponse user,
        Set<String> effectivePermissions,
        List<PermissionDecisionResponse> decisions,
        long authorizationVersion
    ) {
    }

    public record UserRoleRequest(
        @NotNull Long roleId,
        @NotNull Long version,
        @NotBlank @Size(max = 500) String reason
    ) {
    }

    public record OverrideItemRequest(
        @NotBlank String permissionCode,
        @NotNull PermissionOverrideEffect effect,
        @NotBlank @Size(max = 500) String reason,
        Instant effectiveFrom,
        Instant effectiveTo
    ) {
    }

    public record OverridesRequest(
        @NotNull List<@Valid OverrideItemRequest> overrides,
        @NotNull Long version
    ) {
    }

    public record AuditResponse(
        Long id,
        Long actorUserId,
        String actorDisplayName,
        String targetType,
        Long targetId,
        String action,
        String permissionCode,
        String oldValue,
        String newValue,
        String reason,
        BranchAccess branch,
        Instant createdAt
    ) {
    }

    public record CurrentUserResponse(
        Long id,
        String username,
        String displayName,
        AccountStatus status,
        RoleSummary primaryRole,
        Set<String> effectivePermissions,
        List<BranchAccess> branches,
        Long defaultBranchId,
        long authorizationVersion
    ) {
    }
}
