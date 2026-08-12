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

    @EntityGraph(attributePaths = {"service", "itemType", "tiers"})
    List<PriceRule> findByPriceListIdOrderByRulePriorityDescIdAsc(Long priceListId);

    @EntityGraph(attributePaths = {"priceList", "priceList.branch", "service", "itemType", "tiers"})
    Optional<PriceRule> findByIdAndPriceListId(Long id, Long priceListId);

    @EntityGraph(attributePaths = {"priceList", "service", "itemType", "tiers"})
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

    boolean existsByItemTypeId(Long itemTypeId);

    interface PriceListRuleCount {
        Long getPriceListId();
        long getRuleCount();
    }
}
