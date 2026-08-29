package com.laundry.management.servicecatalog.infrastructure;

import com.laundry.management.servicecatalog.domain.CatalogStatus;
import com.laundry.management.servicecatalog.domain.LaundryService;
import com.laundry.management.servicecatalog.domain.ProcessingType;
import com.laundry.management.servicecatalog.domain.UnitType;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LaundryServiceRepository extends JpaRepository<LaundryService, Long> {

    @Query("""
        select service from LaundryService service
        where (:search is null
            or lower(service.nameVi) like :search escape '\\'
            or lower(coalesce(service.nameEn, '')) like :search escape '\\'
            or lower(service.code) like :search escape '\\')
          and (:status is null or service.status = :status)
          and (:processingType is null or service.processingType = :processingType)
          and (:unitType is null or service.defaultUnitType = :unitType)
        """)
    Page<LaundryService> search(
        @Param("search") String search,
        @Param("status") CatalogStatus status,
        @Param("processingType") ProcessingType processingType,
        @Param("unitType") UnitType unitType,
        Pageable pageable
    );

    Optional<LaundryService> findByIdAndStatus(Long id, CatalogStatus status);

    Optional<LaundryService> findByNameViIgnoreCase(String nameVi);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select service from LaundryService service where service.id = :id")
    Optional<LaundryService> lockById(@Param("id") Long id);

    long countByStatus(CatalogStatus status);
}
