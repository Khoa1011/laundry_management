package com.laundry.management.employee.infrastructure;

import com.laundry.management.employee.domain.EmployeeIdentity;
import com.laundry.management.employee.domain.EmployeeIdentityType;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmployeeIdentityRepository extends JpaRepository<EmployeeIdentity, Long> {
    Optional<EmployeeIdentity> findByEmployeeIdAndIdentityType(Long employeeId, EmployeeIdentityType identityType);
    boolean existsByNumberHashAndIdNot(String numberHash, Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from EmployeeIdentity i where i.employee.id = :employeeId and i.identityType = :type")
    Optional<EmployeeIdentity> findForUpdate(@Param("employeeId") Long employeeId,
                                             @Param("type") EmployeeIdentityType type);
}
