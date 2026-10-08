package com.laundry.management.sorting.infrastructure;

import com.laundry.management.sorting.domain.ProcessingGroup;
import com.laundry.management.sorting.domain.SortingAttributes.*;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProcessingGroupRepository extends JpaRepository<ProcessingGroup, Long> {
    @EntityGraph(attributePaths = {"item", "bag", "bag.order"})
    List<ProcessingGroup> findByBagIdOrderBySequenceNumberAsc(Long bagId);
    @EntityGraph(attributePaths = {"item", "bag", "bag.order"})
    List<ProcessingGroup> findByBagOrderIdAndStatus(Long orderId, GroupStatus status);
    Optional<ProcessingGroup> findFirstByBagIdOrderBySequenceNumberDesc(Long bagId);
    boolean existsByBagOrderId(Long orderId);
    Optional<ProcessingGroup> findByIdAndBagOrderBranchId(Long id, Long branchId);
    Optional<ProcessingGroup> findByGroupCodeAndBagOrderBranchId(String groupCode, Long branchId);
    long countByBagOrderBranchIdAndStatus(Long branchId, GroupStatus status);
    long countByBagOrderBranchIdAndStatusAndSeparateWash(Long branchId, GroupStatus status, boolean separateWash);
    @Query("select count(g) from ProcessingGroup g where g.bag.order.branch.id = :branchId and g.status = :status and g.separateWash = false and g.colorGroup <> :unknownColor and g.fabricCare <> :unknownCare")
    long countShareable(@Param("branchId") Long branchId, @Param("status") GroupStatus status,
        @Param("unknownColor") ColorGroup unknownColor, @Param("unknownCare") FabricCare unknownCare);
    @Query("select distinct i.service.id, i.serviceNameSnapshot from ProcessingGroup g join g.item i where g.bag.order.branch.id = :branchId and g.status = :status order by i.serviceNameSnapshot")
    List<Object[]> serviceOptions(@Param("branchId") Long branchId, @Param("status") GroupStatus status);
    @Query("select distinct i.itemType.id, i.itemTypeNameSnapshot from ProcessingGroup g join g.item i where g.bag.order.branch.id = :branchId and g.status = :status order by i.itemTypeNameSnapshot")
    List<Object[]> itemTypeOptions(@Param("branchId") Long branchId, @Param("status") GroupStatus status);

    @EntityGraph(attributePaths = {"bag", "bag.order", "item", "item.service", "item.itemType"})
    @Query("""
        select g from ProcessingGroup g join g.bag b join b.order o join g.item i
        where o.branch.id = :branchId and g.status = :status
          and (:search is null or lower(g.groupCode) like :search escape '!'
            or lower(b.bagCode) like :search escape '!'
            or lower(o.orderCode) like :search escape '!'
            or lower(coalesce(o.customerNameSnapshot,'')) like :search escape '!')
          and (:serviceId is null or i.service.id = :serviceId)
          and (:itemTypeId is null or i.itemType.id = :itemTypeId)
          and (:color is null or g.colorGroup = :color)
          and (:washMode is null or g.washMode = :washMode)
          and (:separateWash is null or g.separateWash = :separateWash)
          and (:promisedFrom is null or o.promisedAt >= :promisedFrom)
          and (:promisedTo is null or o.promisedAt < :promisedTo)
        """)
    Page<ProcessingGroup> searchWaiting(@Param("branchId") Long branchId, @Param("status") GroupStatus status,
        @Param("search") String search, @Param("serviceId") Long serviceId,
        @Param("itemTypeId") Long itemTypeId, @Param("color") ColorGroup color,
        @Param("washMode") WashMode washMode, @Param("separateWash") Boolean separateWash,
        @Param("promisedFrom") Instant promisedFrom, @Param("promisedTo") Instant promisedTo,
        Pageable pageable);
}
