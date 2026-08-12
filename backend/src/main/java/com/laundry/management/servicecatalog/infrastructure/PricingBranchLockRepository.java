package com.laundry.management.servicecatalog.infrastructure;

import com.laundry.management.auth.domain.Branch;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface PricingBranchLockRepository extends Repository<Branch, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select branch from Branch branch where branch.id = :id")
    Optional<Branch> lockById(@Param("id") Long id);
}
