package com.laundry.management.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "authorization_audit_logs")
public class AuthorizationAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_user_id", nullable = false)
    private UserAccount actor;

    @Column(name = "target_type", nullable = false, length = 40)
    private String targetType;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    @Column(nullable = false, length = 60)
    private String action;

    @Column(name = "permission_code", length = 100)
    private String permissionCode;

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    @Column(length = 500)
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id")
    private Branch branch;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AuthorizationAuditLog() {
    }

    public AuthorizationAuditLog(
        UserAccount actor,
        String targetType,
        Long targetId,
        String action,
        String permissionCode,
        String oldValue,
        String newValue,
        String reason,
        Branch branch
    ) {
        this.actor = actor;
        this.targetType = targetType;
        this.targetId = targetId;
        this.action = action;
        this.permissionCode = permissionCode;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.reason = reason;
        this.branch = branch;
    }

    public Long getId() { return id; }
    public UserAccount getActor() { return actor; }
    public String getTargetType() { return targetType; }
    public Long getTargetId() { return targetId; }
    public String getAction() { return action; }
    public String getPermissionCode() { return permissionCode; }
    public String getOldValue() { return oldValue; }
    public String getNewValue() { return newValue; }
    public String getReason() { return reason; }
    public Branch getBranch() { return branch; }
    public Instant getCreatedAt() { return createdAt; }
}
