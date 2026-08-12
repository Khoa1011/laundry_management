package com.laundry.management.employee.domain;

import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
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
@Table(name = "employee_branches")
public class EmployeeBranch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "branch_id", nullable = false)
    private Branch branch;

    @Column(name = "is_primary", nullable = false)
    private boolean primary;

    @Column(name = "active_marker")
    private Boolean activeMarker;

    @Column(name = "primary_marker")
    private Boolean primaryMarker;

    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt;

    @Column(name = "unassigned_at")
    private Instant unassignedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false, updatable = false)
    private UserAccount createdBy;

    protected EmployeeBranch() {
    }

    public EmployeeBranch(Employee employee, Branch branch, boolean primary, UserAccount actor, Instant assignedAt) {
        this.employee = employee;
        this.branch = branch;
        this.primary = primary;
        this.activeMarker = Boolean.TRUE;
        this.primaryMarker = primary ? Boolean.TRUE : null;
        this.assignedAt = assignedAt;
        this.createdBy = actor;
    }

    public void makePrimary() {
        requireActive();
        this.primary = true;
        this.primaryMarker = Boolean.TRUE;
    }

    public void clearPrimary() {
        this.primary = false;
        this.primaryMarker = null;
    }

    public void unassign(Instant when) {
        requireActive();
        this.unassignedAt = when;
        this.primary = false;
        this.activeMarker = null;
        this.primaryMarker = null;
    }

    private void requireActive() {
        if (unassignedAt != null) {
            throw new IllegalStateException("Employee branch assignment is not active");
        }
    }

    public Long getId() { return id; }
    public Employee getEmployee() { return employee; }
    public Branch getBranch() { return branch; }
    public boolean isPrimary() { return primary; }
    public boolean isActive() { return unassignedAt == null; }
    public Instant getAssignedAt() { return assignedAt; }
    public Instant getUnassignedAt() { return unassignedAt; }
}
