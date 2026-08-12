package com.laundry.management.auth.infrastructure;

import com.laundry.management.auth.domain.Role;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoleRepository extends JpaRepository<Role, Long> {

    Optional<Role> findByCode(String code);

    boolean existsByCode(String code);

    @EntityGraph(attributePaths = {"permissions", "createdBy", "updatedBy"})
    @Query("select r from Role r where r.id = :id")
    Optional<Role> findDetailById(@Param("id") Long id);

    @Query("""
        select r from Role r
        where (:search is null or lower(r.code) like :search escape '!'
            or lower(r.displayName) like :search escape '!'
            or lower(r.nameVi) like :search escape '!' or lower(r.nameEn) like :search escape '!')
          and (:status is null or r.status = :status)
          and (:system is null or r.system = :system)
        """)
    Page<Role> search(
        @Param("search") String search,
        @Param("status") com.laundry.management.auth.domain.RoleStatus status,
        @Param("system") Boolean system,
        Pageable pageable
    );
}
