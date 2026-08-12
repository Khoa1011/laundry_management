package com.laundry.management.notification.infrastructure;

import com.laundry.management.auth.domain.UserAccount;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface NotificationRecipientLookupRepository extends Repository<UserAccount, Long> {

    @Query(value = """
        SELECT COUNT(*)
        FROM permissions p
        WHERE p.code = :permissionCode
          AND p.status = 'ACTIVE'
        """, nativeQuery = true)
    long countActivePermission(@Param("permissionCode") String permissionCode);

    @Query(value = """
        SELECT COUNT(*)
        FROM employee_positions ep
        WHERE ep.id IN (:positionIds)
          AND ep.active = TRUE
        """, nativeQuery = true)
    long countActivePositions(@Param("positionIds") Collection<Long> positionIds);

    @Query(value = """
        SELECT DISTINCT u.id
        FROM users u
        WHERE u.id IN (:userIds)
          AND u.status = 'ACTIVE'
          AND u.locked_at IS NULL
          AND (:branchId IS NULL OR EXISTS (
              SELECT 1 FROM user_branches ub
              WHERE ub.user_id = u.id AND ub.branch_id = :branchId
          ))
        """, nativeQuery = true)
    List<Long> findEligibleUserIds(
        @Param("userIds") Collection<Long> userIds,
        @Param("branchId") Long branchId
    );

    @Query(value = """
        SELECT DISTINCT u.id
        FROM employees e
        JOIN users u ON u.id = e.linked_user_id
        JOIN employee_branches eb ON eb.employee_id = e.id
        WHERE e.id IN (:employeeIds)
          AND e.status = 'ACTIVE'
          AND eb.branch_id = :branchId
          AND eb.unassigned_at IS NULL
          AND u.status = 'ACTIVE'
          AND u.locked_at IS NULL
        """, nativeQuery = true)
    List<Long> findActiveEmployeeUserIds(
        @Param("employeeIds") Collection<Long> employeeIds,
        @Param("branchId") Long branchId
    );

    @Query(value = """
        SELECT DISTINCT u.id
        FROM users u
        JOIN user_branches ub ON ub.user_id = u.id
        WHERE ub.branch_id = :branchId
          AND u.status = 'ACTIVE'
          AND u.locked_at IS NULL
        """, nativeQuery = true)
    List<Long> findActiveUserIdsInBranch(@Param("branchId") Long branchId);

    @Query(value = """
        SELECT DISTINCT u.id
        FROM employees e
        JOIN users u ON u.id = e.linked_user_id
        JOIN employee_branches eb ON eb.employee_id = e.id
        WHERE eb.branch_id = :branchId
          AND eb.unassigned_at IS NULL
          AND e.status = 'ACTIVE'
          AND u.status = 'ACTIVE'
          AND u.locked_at IS NULL
        """, nativeQuery = true)
    List<Long> findActiveEmployeeUserIdsInBranch(@Param("branchId") Long branchId);

    @Query(value = """
        SELECT DISTINCT u.id
        FROM employees e
        JOIN users u ON u.id = e.linked_user_id
        JOIN employee_branches eb ON eb.employee_id = e.id
        WHERE eb.branch_id = :branchId
          AND eb.unassigned_at IS NULL
          AND e.position_id IN (:positionIds)
          AND e.status = 'ACTIVE'
          AND u.status = 'ACTIVE'
          AND u.locked_at IS NULL
        """, nativeQuery = true)
    List<Long> findActiveUserIdsByPosition(
        @Param("branchId") Long branchId,
        @Param("positionIds") Collection<Long> positionIds
    );

    @Query(value = """
        SELECT DISTINCT u.id
        FROM users u
        JOIN user_branches ub ON ub.user_id = u.id
        JOIN permissions p ON p.code = :permissionCode AND p.status = 'ACTIVE'
        WHERE ub.branch_id = :branchId
          AND u.status = 'ACTIVE'
          AND u.locked_at IS NULL
          AND NOT EXISTS (
              SELECT 1
              FROM user_permission_overrides denied
              WHERE denied.user_id = u.id
                AND denied.permission_id = p.id
                AND denied.effect = 'DENY'
                AND denied.status = 'ACTIVE'
                AND (denied.effective_from IS NULL OR denied.effective_from <= CURRENT_TIMESTAMP)
                AND (denied.effective_to IS NULL OR denied.effective_to > CURRENT_TIMESTAMP)
          )
          AND (
              EXISTS (
                  SELECT 1
                  FROM user_roles ur
                  JOIN roles r ON r.id = ur.role_id AND r.status = 'ACTIVE'
                  JOIN role_permissions rp ON rp.role_id = r.id AND rp.permission_id = p.id
                  WHERE ur.user_id = u.id
                    AND (ur.effective_from IS NULL OR ur.effective_from <= CURRENT_TIMESTAMP)
                    AND (ur.effective_to IS NULL OR ur.effective_to > CURRENT_TIMESTAMP)
              )
              OR EXISTS (
                  SELECT 1
                  FROM user_permission_overrides allowed
                  WHERE allowed.user_id = u.id
                    AND allowed.permission_id = p.id
                    AND allowed.effect = 'ALLOW'
                    AND allowed.status = 'ACTIVE'
                    AND (allowed.effective_from IS NULL OR allowed.effective_from <= CURRENT_TIMESTAMP)
                    AND (allowed.effective_to IS NULL OR allowed.effective_to > CURRENT_TIMESTAMP)
              )
          )
        """, nativeQuery = true)
    List<Long> findActiveUserIdsByEffectivePermission(
        @Param("branchId") Long branchId,
        @Param("permissionCode") String permissionCode
    );
}
