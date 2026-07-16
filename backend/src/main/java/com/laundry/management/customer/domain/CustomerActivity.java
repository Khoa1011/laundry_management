package com.laundry.management.customer.domain;

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
@Table(name = "customer_audit_activities")
public class CustomerActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "branch_id", nullable = false)
    private Branch branch;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(name = "entity_type", nullable = false, length = 40)
    private String entityType;

    @Column(name = "entity_id", nullable = false)
    private Long entityId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private CustomerActivityAction action;

    @Column(name = "changed_fields", columnDefinition = "TEXT")
    private String changedFields;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_user_id", nullable = false)
    private UserAccount actor;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected CustomerActivity() {
    }

    public CustomerActivity(
        Branch branch,
        Customer customer,
        String entityType,
        Long entityId,
        CustomerActivityAction action,
        String changedFields,
        UserAccount actor
    ) {
        this.branch = branch;
        this.customer = customer;
        this.entityType = entityType;
        this.entityId = entityId;
        this.action = action;
        this.changedFields = changedFields;
        this.actor = actor;
    }

    public Long getId() { return id; }
    public Branch getBranch() { return branch; }
    public Customer getCustomer() { return customer; }
    public String getEntityType() { return entityType; }
    public Long getEntityId() { return entityId; }
    public CustomerActivityAction getAction() { return action; }
    public String getChangedFields() { return changedFields; }
    public UserAccount getActor() { return actor; }
    public Instant getCreatedAt() { return createdAt; }
}
