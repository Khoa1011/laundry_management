package com.laundry.management.order.domain;

import com.laundry.management.auth.domain.Branch;
import jakarta.persistence.*;

@Entity
@Table(name = "branch_order_sequences")
public class BranchOrderSequence {
    @Id
    @Column(name = "branch_id")
    private Long branchId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "branch_id")
    private Branch branch;

    @Column(name = "next_value", nullable = false)
    private long nextValue;

    protected BranchOrderSequence() {}
    public BranchOrderSequence(Branch branch) { this.branch = branch; this.nextValue = 1; }
    public long takeNext() { return nextValue++; }
    public Long getBranchId() { return branchId; }
}
