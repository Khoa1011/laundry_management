package com.laundry.management.auth.infrastructure;

import com.laundry.management.auth.domain.Permission;
import java.util.Optional;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PermissionRepository extends JpaRepository<Permission, Long> {

    Optional<Permission> findByCode(String code);

    List<Permission> findAllByCodeIn(Collection<String> codes);

    List<Permission> findAllByOrderByModuleAscDisplayOrderAscCodeAsc();

    @Query("""
        select p from Permission p
        where (:search is null or lower(p.code) like :search escape '!'
            or lower(p.nameVi) like :search escape '!' or lower(p.nameEn) like :search escape '!')
          and (:module is null or p.module = :module)
          and (:riskLevel is null or p.riskLevel = :riskLevel)
          and (:status is null or p.status = :status)
        """)
    Page<Permission> search(
        @Param("search") String search,
        @Param("module") String module,
        @Param("riskLevel") com.laundry.management.auth.domain.PermissionRiskLevel riskLevel,
        @Param("status") com.laundry.management.auth.domain.PermissionStatus status,
        Pageable pageable
    );
}
