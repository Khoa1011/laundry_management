package com.laundry.management.auth.security;

import com.laundry.management.auth.domain.AccountStatus;
import com.laundry.management.auth.access.application.EffectivePermissionService;
import com.laundry.management.auth.domain.Role;
import com.laundry.management.auth.domain.UserAccount;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public final class AuthenticatedUser implements UserDetails {

    private final Long id;
    private final String username;
    private final String passwordHash;
    private final String displayName;
    private final Long defaultBranchId;
    private final Set<String> roles;
    private final Set<String> permissions;
    private final List<BranchAccess> branches;
    private final boolean active;
    private final long authorizationVersion;

    private AuthenticatedUser(
        Long id,
        String username,
        String passwordHash,
        String displayName,
        Long defaultBranchId,
        Set<String> roles,
        Set<String> permissions,
        List<BranchAccess> branches,
        boolean active,
        long authorizationVersion
    ) {
        this.id = id;
        this.username = username;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
        this.defaultBranchId = defaultBranchId;
        this.roles = Set.copyOf(roles);
        this.permissions = Set.copyOf(permissions);
        this.branches = List.copyOf(branches);
        this.active = active;
        this.authorizationVersion = authorizationVersion;
    }

    public static AuthenticatedUser from(
        UserAccount account,
        EffectivePermissionService.EffectiveAccess effectiveAccess
    ) {
        Set<String> roleCodes = new TreeSet<>();
        for (Role role : account.getRoles()) {
            roleCodes.add(role.getCode());
        }

        List<BranchAccess> branchAccess = account.getBranchAssignments().stream()
            .map(assignment -> new BranchAccess(
                assignment.getBranch().getId(),
                assignment.getBranch().getCode(),
                assignment.getBranch().getName()
            ))
            .sorted(Comparator.comparing(BranchAccess::code))
            .toList();

        return new AuthenticatedUser(
            account.getId(),
            account.getUsername(),
            account.getPasswordHash(),
            account.getDisplayName(),
            account.getDefaultBranch() == null ? null : account.getDefaultBranch().getId(),
            roleCodes,
            effectiveAccess.permissionCodes(),
            branchAccess,
            account.getStatus() == AccountStatus.ACTIVE && !account.isLocked(),
            effectiveAccess.authorizationVersion()
        );
    }

    public Long id() {
        return id;
    }

    public String displayName() {
        return displayName;
    }

    public Long defaultBranchId() {
        return defaultBranchId;
    }

    public Set<String> roles() {
        return roles;
    }

    public Set<String> permissions() {
        return permissions;
    }

    public List<BranchAccess> branches() {
        return branches;
    }

    public long authorizationVersion() { return authorizationVersion; }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return permissions.stream().map(SimpleGrantedAuthority::new).toList();
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isEnabled() {
        return active;
    }
}
