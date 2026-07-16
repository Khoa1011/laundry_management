package com.laundry.management.auth.infrastructure;

import com.laundry.management.auth.domain.Branch;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BranchRepository extends JpaRepository<Branch, Long> {

    Optional<Branch> findByCodeIgnoreCase(String code);
}
