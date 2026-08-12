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
import jakarta.persistence.Version;
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

    @Column(nullable = false, length = 500)
    private String reason;

    @Column(name = "effective_from")
    private Instant effectiveFrom;

    @Column(name = "effective_to")
    private Instant effectiveTo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OverrideStatus status;

    @Version
    @Column(nullable = false)
    private long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserPermissionOverride() {
    }

    public UserPermissionOverride(
        UserAccount user,
        Permission permission,
        PermissionOverrideEffect effect,
        String reason,
        Instant effectiveFrom,
        Instant effectiveTo
    ) {
        this.user = user;
        this.permission = permission;
        this.effect = effect;
        this.reason = reason;
        this.effectiveFrom = effectiveFrom;
        this.effectiveTo = effectiveTo;
        this.status = OverrideStatus.ACTIVE;
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

    public void update(
        PermissionOverrideEffect nextEffect,
        String nextReason,
        Instant nextEffectiveFrom,
        Instant nextEffectiveTo
    ) {
        this.effect = nextEffect;
        this.reason = nextReason;
        this.effectiveFrom = nextEffectiveFrom;
        this.effectiveTo = nextEffectiveTo;
        this.status = OverrideStatus.ACTIVE;
    }

    public boolean isEffectiveAt(Instant instant) {
        return status == OverrideStatus.ACTIVE
            && (effectiveFrom == null || !effectiveFrom.isAfter(instant))
            && (effectiveTo == null || effectiveTo.isAfter(instant));
    }

    public String getReason() { return reason; }
    public Instant getEffectiveFrom() { return effectiveFrom; }
    public Instant getEffectiveTo() { return effectiveTo; }
    public OverrideStatus getStatus() { return status; }
    public long getVersion() { return version; }
}
