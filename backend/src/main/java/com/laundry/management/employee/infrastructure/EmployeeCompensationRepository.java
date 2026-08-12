package com.laundry.management.employee.infrastructure;

import com.laundry.management.employee.domain.EmployeeCompensation;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmployeeCompensationRepository extends JpaRepository<EmployeeCompensation, Long> {
    @EntityGraph(attributePaths = "createdBy")
    List<EmployeeCompensation> findByEmployeeIdOrderByEffectiveFromDescIdDesc(Long employeeId);

    @EntityGraph(attributePaths = "createdBy")
    Page<EmployeeCompensation> findByEmployeeId(Long employeeId, Pageable pageable);

    @EntityGraph(attributePaths = "createdBy")
    @Query("""
        select c from EmployeeCompensation c
        where c.employee.id = :employeeId
          and c.effectiveFrom <= :date
          and (c.effectiveTo is null or c.effectiveTo >= :date)
        order by c.effectiveFrom desc, c.id desc
        """)
    List<EmployeeCompensation> findEffectiveOn(@Param("employeeId") Long employeeId, @Param("date") LocalDate date);
}
