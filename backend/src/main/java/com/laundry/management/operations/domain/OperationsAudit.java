package com.laundry.management.operations.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name = "operations_audit")
public class OperationsAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "branch_id", nullable = false) private Long branchId;
    @Column(nullable = false, length = 20) private String module;
    @Column(nullable = false, length = 40) private String resource;
    @Column(name = "record_id", nullable = false) private Long recordId;
    @Column(nullable = false, length = 20) private String action;
    @Column(name = "actor_id", nullable = false) private Long actorId;
    @Column(name = "occurred_at", nullable = false) private Instant occurredAt;
    @Column(name = "changed_fields", nullable = false, length = 1000) private String changedFields;
    protected OperationsAudit() {}
    public OperationsAudit(Long branchId, String module, String resource, Long recordId, String action,
        Long actorId, Instant occurredAt, String changedFields) {
        this.branchId = branchId; this.module = module; this.resource = resource; this.recordId = recordId;
        this.action = action; this.actorId = actorId; this.occurredAt = occurredAt; this.changedFields = changedFields;
    }
    public Long getId() { return id; }
    public Long getBranchId() { return branchId; }
    public String getModule() { return module; }
    public String getResource() { return resource; }
    public Long getRecordId() { return recordId; }
    public String getAction() { return action; }
    public Long getActorId() { return actorId; }
    public Instant getOccurredAt() { return occurredAt; }
    public String getChangedFields() { return changedFields; }
}
