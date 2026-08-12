package com.laundry.management.employee.infrastructure;

import com.laundry.management.employee.domain.EmployeePosition;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeePositionRepository extends JpaRepository<EmployeePosition, Long> {

    Optional<EmployeePosition> findByCodeIgnoreCase(String code);

    List<EmployeePosition> findAllByOrderBySortOrderAscNameViAscIdAsc();

    List<EmployeePosition> findByActiveTrueOrderBySortOrderAscNameViAscIdAsc();
}
