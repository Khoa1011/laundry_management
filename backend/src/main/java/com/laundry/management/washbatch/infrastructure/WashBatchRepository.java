package com.laundry.management.washbatch.infrastructure;

import com.laundry.management.washbatch.domain.*;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface WashBatchRepository extends JpaRepository<WashBatch,Long> {
    @EntityGraph(attributePaths={"branch","service","createdBy","updatedBy"})
    @Query("""
        select b from WashBatch b where b.branch.id=:branchId
          and (:status is null or b.status=:status)
          and (:search is null or lower(b.batchCode) like :search escape '!')
        """)
    Page<WashBatch> search(@Param("branchId") Long branchId,@Param("status") WashBatchStatus status,@Param("search") String search,Pageable pageable);

    @EntityGraph(attributePaths={"branch","service","createdBy","items","items.orderItem","items.orderItem.order"})
    @Query("select distinct b from WashBatch b where b.id in :ids")
    List<WashBatch> findListDetails(@Param("ids") Collection<Long> ids);

    @EntityGraph(attributePaths={"branch","service","createdBy","updatedBy","readyBy","cancelledBy","items","items.addedBy","items.removedBy","items.orderItem","items.orderItem.order","items.orderItem.order.customer","items.orderItem.service","items.orderItem.itemType"})
    Optional<WashBatch> findByIdAndBranchId(Long id,Long branchId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths={"branch","service","items","items.orderItem","items.orderItem.order","items.orderItem.service","items.orderItem.itemType"})
    @Query("select b from WashBatch b where b.id=:id and b.branch.id=:branchId")
    Optional<WashBatch> findForUpdate(@Param("id") Long id,@Param("branchId") Long branchId);

    long countByBranchIdAndStatus(Long branchId,WashBatchStatus status);

    @EntityGraph(attributePaths={"service","items","items.orderItem"})
    @Query("select distinct b from WashBatch b join b.items bi where b.branch.id=:branchId and bi.orderItem.order.id=:orderId order by b.createdAt desc,b.id desc")
    List<WashBatch> findByOrder(@Param("branchId") Long branchId,@Param("orderId") Long orderId);
}
