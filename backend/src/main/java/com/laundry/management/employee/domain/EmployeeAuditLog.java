package com.laundry.management.employee.domain;

import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
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
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "employee_audit_logs")
public class EmployeeAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private EmployeeAuditAction action;

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    @Column(length = 500)
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id")
    private Branch branch;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_user_id", nullable = false)
    private UserAccount actor;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected EmployeeAuditLog() {
    }

    public EmployeeAuditLog(
        Employee employee,
        EmployeeAuditAction action,
        String oldValue,
        String newValue,
        String reason,
        Branch branch,
        UserAccount actor
    ) {
        this.employee = employee;
        this.action = action;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.reason = reason;
        this.branch = branch;
        this.actor = actor;
    }

    public Long getId() { return id; }
    public Employee getEmployee() { return employee; }
    public EmployeeAuditAction getAction() { return action; }
    public String getOldValue() { return oldValue; }
    public String getNewValue() { return newValue; }
    public String getReason() { return reason; }
    public Branch getBranch() { return branch; }
    public UserAccount getActor() { return actor; }
    public Instant getCreatedAt() { return createdAt; }
}
