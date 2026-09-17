package com.laundry.management.washbatch.application;

import com.laundry.management.auth.domain.Branch;
import com.laundry.management.washbatch.domain.BranchWashBatchSequence;
import com.laundry.management.washbatch.infrastructure.BranchWashBatchSequenceRepository;
import org.springframework.stereotype.Component;

@Component
public class WashBatchNumberGenerator {
    private final BranchWashBatchSequenceRepository sequences;
    public WashBatchNumberGenerator(BranchWashBatchSequenceRepository sequences){this.sequences=sequences;}
    public String next(Branch lockedBranch){BranchWashBatchSequence sequence=sequences.findForUpdate(lockedBranch.getId())
        .orElseGet(()->sequences.saveAndFlush(new BranchWashBatchSequence(lockedBranch)));
        return lockedBranch.getCode().toUpperCase()+"-MG-"+String.format("%06d",sequence.takeNext());}
}
