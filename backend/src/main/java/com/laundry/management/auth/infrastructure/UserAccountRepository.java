package com.laundry.management.auth.infrastructure;

import com.laundry.management.auth.domain.UserAccount;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {

    @EntityGraph(attributePaths = {"permissionOverrides", "permissionOverrides.permission"})
    Optional<UserAccount> findByUsernameIgnoreCase(String username);

    @Query("select u from UserAccount u where u.id = :id")
    Optional<UserAccount> findAccessById(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UserAccount u where u.id = :id")
    Optional<UserAccount> findByIdForUpdate(@Param("id") Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        update UserAccount u
        set u.authorizationVersion = u.authorizationVersion + 1
        where exists (
            select 1 from UserAccount candidate join candidate.roles r
            where candidate = u and r.id = :roleId
        )
        """)
    int incrementAuthorizationVersionByRoleId(@Param("roleId") Long roleId);

    long countByRolesId(Long roleId);

    @Query("""
        select r.id, count(u.id)
        from UserAccount u join u.roles r
        where r.id in :roleIds
        group by r.id
        """)
    List<Object[]> countUsersByRoleIds(@Param("roleIds") Collection<Long> roleIds);

    @Query("""
        select distinct u from UserAccount u
        left join u.roles r
        left join u.permissionOverrides o
        where (:search is null or lower(u.username) like :search escape '!'
            or lower(u.displayName) like :search escape '!')
          and (:roleId is null or r.id = :roleId)
          and (:status is null or u.status = :status)
          and exists (
              select 1 from UserBranch scopeAssignment
              where scopeAssignment.user = u and scopeAssignment.branch.id in :allowedBranchIds
          )
          and (:branchId is null or exists (
              select 1 from UserBranch ub where ub.user = u and ub.branch.id = :branchId
          ))
          and (:hasOverrides is null
              or (:hasOverrides = true and o.id is not null)
              or (:hasOverrides = false and o.id is null))
        """)
    Page<UserAccount> searchAccessUsers(
        @Param("search") String search,
        @Param("roleId") Long roleId,
        @Param("status") com.laundry.management.auth.domain.AccountStatus status,
        @Param("branchId") Long branchId,
        @Param("hasOverrides") Boolean hasOverrides,
        @Param("allowedBranchIds") Collection<Long> allowedBranchIds,
        Pageable pageable
    );

    @Query("""
        select distinct u from UserAccount u
        where (:search is null
            or lower(u.username) like :search escape '!'
            or lower(u.displayName) like :search escape '!')
          and (:allBranches = true or exists (
            select 1 from UserBranch ub
            where ub.user = u and ub.branch.id in :allowedBranchIds
          ))
          and (:allBranches = true or not exists (
            select 1 from UserBranch outsideScope
            where outsideScope.user = u and outsideScope.branch.id not in :allowedBranchIds
          ))
          and not exists (
            select e.id from Employee e
            where e.linkedUser = u
              and (:employeeId is null or e.id <> :employeeId)
          )
        """)
    Page<UserAccount> searchEmployeeLinkCandidates(
        @Param("search") String search,
        @Param("allBranches") boolean allBranches,
        @Param("allowedBranchIds") Collection<Long> allowedBranchIds,
        @Param("employeeId") Long employeeId,
        Pageable pageable
    );
}
