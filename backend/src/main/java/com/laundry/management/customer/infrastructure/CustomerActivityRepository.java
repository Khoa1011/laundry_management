package com.laundry.management.customer.infrastructure;

import com.laundry.management.customer.domain.CustomerActivity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerActivityRepository extends JpaRepository<CustomerActivity, Long> {

    @EntityGraph(attributePaths = {"actor", "branch"})
    Page<CustomerActivity> findByCustomerIdAndBranchId(Long customerId, Long branchId, Pageable pageable);
}
