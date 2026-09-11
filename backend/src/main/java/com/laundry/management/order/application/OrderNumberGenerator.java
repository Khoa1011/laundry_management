package com.laundry.management.order.application;

import com.laundry.management.auth.domain.Branch;
import com.laundry.management.order.domain.BranchOrderSequence;
import com.laundry.management.order.infrastructure.BranchOrderSequenceRepository;
import org.springframework.stereotype.Component;

@Component
public class OrderNumberGenerator {
    private final BranchOrderSequenceRepository sequences;
    public OrderNumberGenerator(BranchOrderSequenceRepository sequences){this.sequences=sequences;}
    public String next(Branch lockedBranch) {
        BranchOrderSequence sequence=sequences.findForUpdate(lockedBranch.getId())
            .orElseGet(() -> sequences.saveAndFlush(new BranchOrderSequence(lockedBranch)));
        return lockedBranch.getCode().toUpperCase()+"-DH-"+String.format("%06d", sequence.takeNext());
    }
}
