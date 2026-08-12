package com.laundry.management.servicecatalog.infrastructure;

import com.laundry.management.servicecatalog.domain.PricingAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PricingAuditRepository extends JpaRepository<PricingAuditLog, Long> {

    @EntityGraph(attributePaths = {"branch", "actor"})
    Page<PricingAuditLog> findByEntityTypeAndEntityId(
        String entityType,
        Long entityId,
        Pageable pageable
    );
}
