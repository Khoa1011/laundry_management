package com.laundry.management.servicecatalog.infrastructure;

import com.laundry.management.servicecatalog.domain.PriceRule;
import com.laundry.management.servicecatalog.domain.PriceRuleStatus;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PriceRuleRepository extends JpaRepository<PriceRule, Long> {

    @EntityGraph(attributePaths = {"service", "itemType", "tiers", "packagePrices"})
    List<PriceRule> findByPriceListIdOrderByRulePriorityDescIdAsc(Long priceListId);

    @EntityGraph(attributePaths = {"priceList", "priceList.branch", "service", "itemType", "tiers", "packagePrices"})
    Optional<PriceRule> findByIdAndPriceListId(Long id, Long priceListId);

    @EntityGraph(attributePaths = {"priceList", "service", "itemType", "tiers", "packagePrices"})
    @Query("""
        select rule from PriceRule rule
        where rule.priceList.id = :priceListId
          and rule.status in :statuses
          and rule.service.id = :serviceId
          and (rule.itemType is null or rule.itemType.id = :itemTypeId)
          and (rule.sharingMode = com.laundry.management.servicecatalog.domain.SharingMode.ANY
               or rule.sharingMode = :sharingMode)
          and (rule.priorityLevel is null or rule.priorityLevel = :priorityLevel)
          and rule.effectiveFrom <= :effectiveAt
          and (rule.effectiveTo is null or rule.effectiveTo > :effectiveAt)
          and (rule.maximumQuantity is null or rule.maximumQuantity >= :quantity)
        """)
    List<PriceRule> findResolutionCandidates(
        @Param("priceListId") Long priceListId,
        @Param("statuses") Collection<PriceRuleStatus> statuses,
        @Param("serviceId") Long serviceId,
        @Param("itemTypeId") Long itemTypeId,
        @Param("sharingMode") com.laundry.management.servicecatalog.domain.SharingMode sharingMode,
        @Param("priorityLevel") Integer priorityLevel,
        @Param("quantity") java.math.BigDecimal quantity,
        @Param("effectiveAt") Instant effectiveAt
    );

    long countByPriceListId(Long priceListId);

    @Query("""
        select rule.priceList.id as priceListId, count(rule.id) as ruleCount
        from PriceRule rule
        where rule.priceList.id in :priceListIds
        group by rule.priceList.id
        """)
    List<PriceListRuleCount> countByPriceListIds(@Param("priceListIds") Collection<Long> priceListIds);

    boolean existsByServiceId(Long serviceId);
    long countByServiceId(Long serviceId);

    boolean existsByItemTypeId(Long itemTypeId);
    long countByItemTypeId(Long itemTypeId);

    @Query("""
        select count(rule) from PriceRule rule
        where rule.service.id = :serviceId
          and rule.priceList.status in :statuses
          and (rule.priceList.effectiveTo is null or rule.priceList.effectiveTo > :now)
        """)
    long countPublishedReferencesByServiceId(
        @Param("serviceId") Long serviceId,
        @Param("statuses") Collection<com.laundry.management.servicecatalog.domain.PriceListStatus> statuses,
        @Param("now") Instant now
    );

    @Query("""
        select count(rule) from PriceRule rule
        where rule.itemType.id = :itemTypeId
          and rule.priceList.status in :statuses
          and (rule.priceList.effectiveTo is null or rule.priceList.effectiveTo > :now)
        """)
    long countPublishedReferencesByItemTypeId(
        @Param("itemTypeId") Long itemTypeId,
        @Param("statuses") Collection<com.laundry.management.servicecatalog.domain.PriceListStatus> statuses,
        @Param("now") Instant now
    );

    @Query("""
        select count(rule) from PriceRule rule
        where rule.service.id = :serviceId
          and rule.itemType.id = :itemTypeId
          and rule.priceList.status in :statuses
          and (rule.priceList.effectiveTo is null or rule.priceList.effectiveTo > :now)
        """)
    long countPublishedReferencesByServiceIdAndItemTypeId(
        @Param("serviceId") Long serviceId,
        @Param("itemTypeId") Long itemTypeId,
        @Param("statuses") Collection<com.laundry.management.servicecatalog.domain.PriceListStatus> statuses,
        @Param("now") Instant now
    );

    @Query("""
        select rule.service.id as serviceId, count(rule.id) as ruleCount
        from PriceRule rule
        where rule.service.id in :serviceIds
        group by rule.service.id
        """)
    List<ServiceRuleCount> countByServiceIds(@Param("serviceIds") Collection<Long> serviceIds);

    @Query("""
        select rule.itemType.id as itemTypeId, count(rule.id) as ruleCount
        from PriceRule rule
        where rule.itemType.id in :itemTypeIds
        group by rule.itemType.id
        """)
    List<ItemTypeRuleCount> countByItemTypeIds(@Param("itemTypeIds") Collection<Long> itemTypeIds);

    interface PriceListRuleCount {
        Long getPriceListId();
        long getRuleCount();
    }

    interface ServiceRuleCount {
        Long getServiceId();
        long getRuleCount();
    }


    interface ItemTypeRuleCount {
        Long getItemTypeId();
        long getRuleCount();
    }
}
