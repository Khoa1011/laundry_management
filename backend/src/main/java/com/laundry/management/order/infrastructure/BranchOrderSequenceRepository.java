package com.laundry.management.order.infrastructure;

import com.laundry.management.order.domain.BranchOrderSequence;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BranchOrderSequenceRepository extends JpaRepository<BranchOrderSequence, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from BranchOrderSequence s where s.branchId = :branchId")
    Optional<BranchOrderSequence> findForUpdate(@Param("branchId") Long branchId);
}
