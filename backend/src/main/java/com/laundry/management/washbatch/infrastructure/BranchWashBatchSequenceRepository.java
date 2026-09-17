package com.laundry.management.washbatch.infrastructure;

import com.laundry.management.washbatch.domain.BranchWashBatchSequence;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface BranchWashBatchSequenceRepository extends JpaRepository<BranchWashBatchSequence,Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select s from BranchWashBatchSequence s where s.branchId=:branchId")
    Optional<BranchWashBatchSequence> findForUpdate(@Param("branchId") Long branchId);
}
