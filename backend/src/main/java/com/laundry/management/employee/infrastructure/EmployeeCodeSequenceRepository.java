package com.laundry.management.employee.infrastructure;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmployeeCodeSequenceRepository extends JpaRepository<EmployeeCodeSequence, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select sequence from EmployeeCodeSequence sequence where sequence.sequenceName = :name")
    Optional<EmployeeCodeSequence> findByNameForUpdate(@Param("name") String name);
}
