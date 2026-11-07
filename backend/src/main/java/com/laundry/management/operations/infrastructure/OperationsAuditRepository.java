package com.laundry.management.operations.infrastructure;

import com.laundry.management.operations.domain.OperationsAudit;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OperationsAuditRepository extends JpaRepository<OperationsAudit, Long> {
    Page<OperationsAudit> findByBranchIdAndModule(Long branchId, String module, Pageable pageable);
}
