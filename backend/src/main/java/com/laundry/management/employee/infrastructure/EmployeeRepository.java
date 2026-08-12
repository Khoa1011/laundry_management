package com.laundry.management.employee.infrastructure;

import com.laundry.management.employee.domain.Employee;
import com.laundry.management.employee.domain.EmployeeStatus;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    Optional<Employee> findByLinkedUserId(Long linkedUserId);

    boolean existsByLinkedUserId(Long linkedUserId);

    boolean existsByLinkedUserIdAndIdNot(Long linkedUserId, Long employeeId);

    @EntityGraph(attributePaths = {"position", "linkedUser"})
    @Query("select e from Employee e where e.id = :id")
    Optional<Employee> findDetailById(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"position", "linkedUser"})
    @Query("select e from Employee e where e.id = :id")
    Optional<Employee> findDetailByIdForUpdate(@Param("id") Long id);

    @EntityGraph(attributePaths = {"position", "linkedUser"})
    @Query("""
        select distinct e from Employee e
        join e.position p
        left join e.linkedUser linkedUser
        where (:allBranches = true or exists (
            select eb.id from EmployeeBranch eb
            where eb.employee = e
              and eb.unassignedAt is null
              and eb.branch.id in :allowedBranchIds
        ))
          and (:branchId is null or exists (
            select filteredBranch.id from EmployeeBranch filteredBranch
            where filteredBranch.employee = e
              and filteredBranch.unassignedAt is null
              and filteredBranch.branch.id = :branchId
          ))
          and (:status is null or e.status = :status)
          and (:positionId is null or p.id = :positionId)
          and (
            :accountStatus is null
            or (:accountStatus = 'HAS_ACCOUNT' and linkedUser is not null)
            or (:accountStatus = 'NO_ACCOUNT' and linkedUser is null)
            or (:accountStatus = 'ACCOUNT_ACTIVE' and linkedUser.status = com.laundry.management.auth.domain.AccountStatus.ACTIVE and linkedUser.lockedAt is null)
            or (:accountStatus = 'ACCOUNT_INACTIVE' and linkedUser.status = com.laundry.management.auth.domain.AccountStatus.INACTIVE and linkedUser.lockedAt is null)
            or (:accountStatus = 'ACCOUNT_LOCKED' and linkedUser.lockedAt is not null)
          )
          and (
            :searchPattern is null
            or lower(e.employeeCode) like :searchPattern escape '!'
            or lower(e.fullName) like :searchPattern escape '!'
            or lower(e.phone) like :searchPattern escape '!'
            or lower(e.normalizedPhone) like :searchPattern escape '!'
            or lower(e.email) like :searchPattern escape '!'
          )
        """)
    Page<Employee> search(
        @Param("allBranches") boolean allBranches,
        @Param("allowedBranchIds") Collection<Long> allowedBranchIds,
        @Param("branchId") Long branchId,
        @Param("status") EmployeeStatus status,
        @Param("positionId") Long positionId,
        @Param("accountStatus") String accountStatus,
        @Param("searchPattern") String searchPattern,
        Pageable pageable
    );
}
