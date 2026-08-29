package com.laundry.management.servicecatalog.infrastructure;

import com.laundry.management.servicecatalog.domain.PriceList;
import com.laundry.management.servicecatalog.domain.PriceListStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PriceListRepository extends JpaRepository<PriceList, Long> {

    @EntityGraph(attributePaths = {"branch", "updatedBy"})
    @Query("""
        select list from PriceList list
        where list.branch.id in :branchIds
          and (:branchId is null or list.branch.id = :branchId)
          and (:status is null or list.status = :status)
          and (:search is null or lower(list.name) like :search escape '\\' or lower(list.code) like :search escape '\\')
        """)
    Page<PriceList> search(
        @Param("branchIds") Collection<Long> branchIds,
        @Param("branchId") Long branchId,
        @Param("status") PriceListStatus status,
        @Param("search") String search,
        Pageable pageable
    );

    @EntityGraph(attributePaths = {"branch", "updatedBy", "publishedBy"})
    Optional<PriceList> findByIdAndBranchId(Long id, Long branchId);

    Optional<PriceList> findByNameIgnoreCaseAndBranchId(String name, Long branchId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select list from PriceList list join fetch list.branch where list.id = :id")
    Optional<PriceList> lockById(@Param("id") Long id);

    @EntityGraph(attributePaths = "branch")
    @Query("""
        select list from PriceList list
        where list.branch.id = :branchId
          and list.publishedAt is not null
          and list.status in :statuses
          and list.effectiveFrom <= :effectiveAt
          and (list.effectiveTo is null or list.effectiveTo > :effectiveAt)
        order by list.effectiveFrom desc, list.id desc
        """)
    List<PriceList> findEffective(
        @Param("branchId") Long branchId,
        @Param("statuses") Collection<PriceListStatus> statuses,
        @Param("effectiveAt") Instant effectiveAt
    );

    @EntityGraph(attributePaths = "branch")
    @Query("""
        select list from PriceList list
        where list.branch.id = :branchId
          and list.id <> :excludedId
          and list.publishedAt is not null
          and list.status in :statuses
          and (:end is null or list.effectiveFrom < :end)
          and (list.effectiveTo is null or list.effectiveTo > :start)
        order by list.effectiveFrom asc, list.id asc
        """)
    List<PriceList> findOverlappingPublished(
        @Param("branchId") Long branchId,
        @Param("excludedId") Long excludedId,
        @Param("statuses") Collection<PriceListStatus> statuses,
        @Param("start") Instant start,
        @Param("end") Instant end
    );
}
