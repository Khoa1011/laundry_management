package com.laundry.management.servicecatalog.infrastructure;

import com.laundry.management.servicecatalog.domain.ServiceItemEligibility;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ServiceItemEligibilityRepository extends JpaRepository<ServiceItemEligibility, Long> {

    boolean existsByServiceIdAndItemTypeId(Long serviceId, Long itemTypeId);

    boolean existsByServiceId(Long serviceId);

    @EntityGraph(attributePaths = {"service", "itemType", "itemType.parent"})
    List<ServiceItemEligibility> findByServiceIdOrderByItemTypeNameViAscItemTypeIdAsc(Long serviceId);

    @EntityGraph(attributePaths = {"service", "itemType"})
    List<ServiceItemEligibility> findAllByOrderByServiceIdAscItemTypeIdAsc();

    @Modifying
    @Query("delete from ServiceItemEligibility eligibility where eligibility.service.id = :serviceId")
    void deleteByServiceId(@Param("serviceId") Long serviceId);

    long countByServiceId(Long serviceId);

    long countByItemTypeId(Long itemTypeId);

    @Query("""
        select eligibility.service.id as serviceId, count(eligibility.id) as itemCount
        from ServiceItemEligibility eligibility
        where eligibility.service.id in :serviceIds
        group by eligibility.service.id
        """)
    List<ServiceEligibilityCount> countByServiceIds(@Param("serviceIds") Collection<Long> serviceIds);

    @Query("""
        select eligibility.itemType.id as itemTypeId, count(eligibility.id) as serviceCount
        from ServiceItemEligibility eligibility
        where eligibility.itemType.id in :itemTypeIds
        group by eligibility.itemType.id
        """)
    List<ItemTypeEligibilityCount> countByItemTypeIds(@Param("itemTypeIds") Collection<Long> itemTypeIds);

    interface ServiceEligibilityCount {
        Long getServiceId();
        long getItemCount();
    }


    interface ItemTypeEligibilityCount {
        Long getItemTypeId();
        long getServiceCount();
    }
}
