package com.laundry.management.employee.infrastructure;

import com.laundry.management.employee.domain.EmployeeBranch;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmployeeBranchRepository extends JpaRepository<EmployeeBranch, Long> {

    @EntityGraph(attributePaths = "branch")
    @Query("""
        select eb from EmployeeBranch eb
        where eb.employee.id = :employeeId and eb.unassignedAt is null
        order by eb.primary desc, eb.assignedAt asc, eb.id asc
        """)
    List<EmployeeBranch> findActiveByEmployeeId(@Param("employeeId") Long employeeId);

    @EntityGraph(attributePaths = "branch")
    @Query("""
        select eb from EmployeeBranch eb
        where eb.employee.id in :employeeIds and eb.unassignedAt is null
        order by eb.employee.id asc, eb.primary desc, eb.assignedAt asc, eb.id asc
        """)
    List<EmployeeBranch> findActiveByEmployeeIds(@Param("employeeIds") Collection<Long> employeeIds);

    @EntityGraph(attributePaths = "branch")
    @Query("""
        select eb from EmployeeBranch eb
        where eb.employee.id = :employeeId
        order by eb.assignedAt desc, eb.id desc
        """)
    List<EmployeeBranch> findHistoryByEmployeeId(@Param("employeeId") Long employeeId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = "branch")
    @Query("""
        select eb from EmployeeBranch eb
        where eb.employee.id = :employeeId and eb.unassignedAt is null
        order by eb.id asc
        """)
    List<EmployeeBranch> findActiveByEmployeeIdForUpdate(@Param("employeeId") Long employeeId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = "branch")
    @Query("""
        select eb from EmployeeBranch eb
        where eb.employee.id = :employeeId
          and eb.branch.id = :branchId
          and eb.unassignedAt is null
        """)
    Optional<EmployeeBranch> findActiveForUpdate(
        @Param("employeeId") Long employeeId,
        @Param("branchId") Long branchId
    );

    @Query("""
        select count(eb) > 0 from EmployeeBranch eb
        where eb.employee.id = :employeeId
          and eb.unassignedAt is null
          and eb.branch.id in :branchIds
        """)
    boolean existsActiveInScope(
        @Param("employeeId") Long employeeId,
        @Param("branchIds") Collection<Long> branchIds
    );
}
