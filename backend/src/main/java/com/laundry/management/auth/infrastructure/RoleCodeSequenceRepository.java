package com.laundry.management.auth.infrastructure;

import com.laundry.management.auth.domain.RoleCodeSequence;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleCodeSequenceRepository extends JpaRepository<RoleCodeSequence, Long> {
}

