package com.laundry.management.employee.infrastructure;

import com.laundry.management.employee.domain.EmployeeAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeAuditRepository extends JpaRepository<EmployeeAuditLog, Long> {

    @EntityGraph(attributePaths = {"actor", "branch"})
    Page<EmployeeAuditLog> findByEmployeeId(Long employeeId, Pageable pageable);
}
