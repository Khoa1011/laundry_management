package com.laundry.management.operations.domain;

import jakarta.persistence.*;
import java.time.Instant;

/** Shared identity and audit fields; balances and posting never belong to master data. */
@MappedSuperclass
public abstract class CatalogRecord {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "branch_id", nullable = false, updatable = false)
    private Long branchId;
    @Column(nullable = false, length = 80, updatable = false)
    private String code;
    @Column(nullable = false, length = 150)
    private String name;
    @Column(nullable = false)
    private boolean active;
    @Column(length = 1000)
    private String note;
    @Version
    private long version;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Column(name = "created_by", nullable = false, updatable = false)
    private Long createdBy;
    @Column(name = "updated_by", nullable = false)
    private Long updatedBy;

    protected CatalogRecord() {}

    public void initialize(Long branchId, String code, Long actor, Instant now) {
        if (id != null || this.branchId != null) throw new IllegalStateException("Already initialized");
        this.branchId = branchId;
        this.code = code;
        this.createdBy = actor;
        this.createdAt = now;
    }

    public void update(String name, boolean active, String note, Long actor, Instant now) {
        this.name = name.trim();
        this.active = active;
        this.note = note == null || note.isBlank() ? null : note.trim();
        this.updatedBy = actor;
        this.updatedAt = now;
    }

    public Long getId() { return id; }
    public Long getBranchId() { return branchId; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public boolean isActive() { return active; }
    public String getNote() { return note; }
    public long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
