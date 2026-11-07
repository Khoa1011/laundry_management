package com.laundry.management.operations.infrastructure;

import com.laundry.management.operations.domain.CatalogRecord;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.NoRepositoryBean;

@NoRepositoryBean
public interface CatalogRepository<T extends CatalogRecord> extends JpaRepository<T, Long>, JpaSpecificationExecutor<T> {
    Optional<T> findByIdAndBranchId(Long id, Long branchId);
    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select r from #{#entityName} r where r.id=:id and r.branchId=:branchId")
    Optional<T> findCurrentByIdAndBranchId(@Param("id") Long id, @Param("branchId") Long branchId);
}
