package com.laundry.management.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(
    name = "user_permission_overrides",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_user_permission_override",
        columnNames = {"user_id", "permission_id"}
    )
)
public class UserPermissionOverride {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "permission_id", nullable = false)
    private Permission permission;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private PermissionOverrideEffect effect;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserPermissionOverride() {
    }

    UserPermissionOverride(UserAccount user, Permission permission, PermissionOverrideEffect effect) {
        this.user = user;
        this.permission = permission;
        this.effect = effect;
    }

    public Permission getPermission() {
        return permission;
    }

    public PermissionOverrideEffect getEffect() {
        return effect;
    }

    public void changeEffect(PermissionOverrideEffect nextEffect) {
        this.effect = nextEffect;
    }
}
