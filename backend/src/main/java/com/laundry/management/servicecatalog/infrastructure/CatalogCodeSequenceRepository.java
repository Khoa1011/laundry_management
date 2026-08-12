package com.laundry.management.servicecatalog.infrastructure;

import com.laundry.management.servicecatalog.domain.CatalogCodeSequence;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CatalogCodeSequenceRepository extends JpaRepository<CatalogCodeSequence, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select sequence from CatalogCodeSequence sequence where sequence.sequenceName = :name")
    CatalogCodeSequence lockByName(@Param("name") String name);
}
