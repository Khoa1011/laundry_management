package com.laundry.management.auth.infrastructure;

import com.laundry.management.auth.domain.AuthorizationAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuthorizationAuditRepository extends JpaRepository<AuthorizationAuditLog, Long> {

    @EntityGraph(attributePaths = {"actor", "branch"})
    @Query("""
        select a from AuthorizationAuditLog a
        where (:targetType is null or a.targetType = :targetType)
          and (:targetId is null or a.targetId = :targetId)
          and (:action is null or a.action = :action)
          and (:permissionCode is null or a.permissionCode = :permissionCode)
        """)
    Page<AuthorizationAuditLog> search(
        @Param("targetType") String targetType,
        @Param("targetId") Long targetId,
        @Param("action") String action,
        @Param("permissionCode") String permissionCode,
        Pageable pageable
    );
}
