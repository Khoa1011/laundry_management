package com.laundry.management.auth.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "users")
public class UserAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String username;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(name = "display_name", nullable = false, length = 150)
    private String displayName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "default_branch_id")
    private Branch defaultBranch;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AccountStatus status;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "user_roles",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> roles = new LinkedHashSet<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<UserBranch> branchAssignments = new LinkedHashSet<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<UserPermissionOverride> permissionOverrides = new LinkedHashSet<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserAccount() {
    }

    public UserAccount(String username, String passwordHash, String displayName, Branch defaultBranch) {
        this.username = username;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
        this.defaultBranch = defaultBranch;
        this.status = AccountStatus.ACTIVE;
    }

    public void addRole(Role role) {
        roles.add(role);
    }

    public void assignBranch(Branch branch, boolean asDefault) {
        branchAssignments.add(new UserBranch(this, branch, asDefault));
        if (asDefault) {
            defaultBranch = branch;
        }
    }

    public void deactivate() {
        status = AccountStatus.INACTIVE;
    }

    public void overridePermission(Permission permission, PermissionOverrideEffect effect) {
        permissionOverrides.stream()
            .filter(existing -> existing.getPermission().getCode().equals(permission.getCode()))
            .findFirst()
            .ifPresentOrElse(
                existing -> existing.changeEffect(effect),
                () -> permissionOverrides.add(new UserPermissionOverride(this, permission, effect))
            );
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getDisplayName() {
        return displayName;
    }

    public Branch getDefaultBranch() {
        return defaultBranch;
    }

    public AccountStatus getStatus() {
        return status;
    }

    public Set<Role> getRoles() {
        return Set.copyOf(roles);
    }

    public Set<UserBranch> getBranchAssignments() {
        return Set.copyOf(branchAssignments);
    }

    public Set<UserPermissionOverride> getPermissionOverrides() {
        return Set.copyOf(permissionOverrides);
    }
}
