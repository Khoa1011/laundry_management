package com.laundry.management.operations.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@MappedSuperclass
public abstract class PolicySettings {
    @Id @Column(name="branch_id") private Long branchId;
    @Version private long version;
    @Column(name="approval_required", nullable=false) private boolean approvalRequired = true;
    @Column(name="approval_threshold", nullable=false, precision=19, scale=2) private BigDecimal approvalThreshold = BigDecimal.ZERO;
    @Column(name="allow_negative", nullable=false) private boolean allowNegative;
    @Column(name="updated_at", nullable=false) private Instant updatedAt;
    @Column(name="updated_by", nullable=false) private Long updatedBy;
    protected PolicySettings() {}
    protected PolicySettings(Long branchId) { this.branchId=branchId; }
    public void update(boolean approvalRequired, BigDecimal threshold, boolean allowNegative, Long actor, Instant now) {
        this.approvalRequired=approvalRequired; this.approvalThreshold=threshold;
        this.allowNegative=allowNegative; this.updatedBy=actor; this.updatedAt=now;
    }
    public Long getBranchId() { return branchId; }
    public long getVersion() { return version; }
    public boolean isApprovalRequired() { return approvalRequired; }
    public BigDecimal getApprovalThreshold() { return approvalThreshold; }
    public boolean isAllowNegative() { return allowNegative; }
    public Instant getUpdatedAt() { return updatedAt; }
}
