package com.laundry.management.washbatch.infrastructure;

import com.laundry.management.washbatch.domain.*;
import com.laundry.management.auth.domain.UserAccount;
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
          and (:serviceId is null or b.service.id=:serviceId)
          and (:createdBy is null or b.createdBy.id=:createdBy)
          and (:createdFrom is null or b.createdAt>=:createdFrom)
          and (:createdTo is null or b.createdAt<:createdTo)
          and (:privateOnly=false or exists (select pi.id from WashBatchItem pi where pi.batch=b and ((b.status=com.laundry.management.washbatch.domain.WashBatchStatus.CANCELLED and pi.removalReason=com.laundry.management.washbatch.domain.WashBatchItemRemovalReason.BATCH_CANCELLED) or (b.status<>com.laundry.management.washbatch.domain.WashBatchStatus.CANCELLED and pi.removedAt is null)) and pi.orderItem.sharingModeSnapshot=com.laundry.management.servicecatalog.domain.SharingMode.PRIVATE_LOAD))
          and (:sharedOnly=false or not exists (select si.id from WashBatchItem si where si.batch=b and ((b.status=com.laundry.management.washbatch.domain.WashBatchStatus.CANCELLED and si.removalReason=com.laundry.management.washbatch.domain.WashBatchItemRemovalReason.BATCH_CANCELLED) or (b.status<>com.laundry.management.washbatch.domain.WashBatchStatus.CANCELLED and si.removedAt is null)) and si.orderItem.sharingModeSnapshot=com.laundry.management.servicecatalog.domain.SharingMode.PRIVATE_LOAD))
          and (:notesOnly=false or exists (select ni.id from WashBatchItem ni where ni.batch=b and ((b.status=com.laundry.management.washbatch.domain.WashBatchStatus.CANCELLED and ni.removalReason=com.laundry.management.washbatch.domain.WashBatchItemRemovalReason.BATCH_CANCELLED) or (b.status<>com.laundry.management.washbatch.domain.WashBatchStatus.CANCELLED and ni.removedAt is null)) and ni.orderItem.note is not null and trim(ni.orderItem.note)<>''))
          and (:mixedOnly=false or (select count(distinct mi.orderItem.itemType.id) from WashBatchItem mi where mi.batch=b and ((b.status=com.laundry.management.washbatch.domain.WashBatchStatus.CANCELLED and mi.removalReason=com.laundry.management.washbatch.domain.WashBatchItemRemovalReason.BATCH_CANCELLED) or (b.status<>com.laundry.management.washbatch.domain.WashBatchStatus.CANCELLED and mi.removedAt is null)))>1)
          and (:priorityOnly=false or exists (select pri.id from WashBatchItem pri where pri.batch=b and ((b.status=com.laundry.management.washbatch.domain.WashBatchStatus.CANCELLED and pri.removalReason=com.laundry.management.washbatch.domain.WashBatchItemRemovalReason.BATCH_CANCELLED) or (b.status<>com.laundry.management.washbatch.domain.WashBatchStatus.CANCELLED and pri.removedAt is null)) and pri.orderItem.sharingModeSnapshot=com.laundry.management.servicecatalog.domain.SharingMode.SHARED_PRIORITY))
          and (:dueSoonOnly=false or exists (select di.id from WashBatchItem di where di.batch=b and ((b.status=com.laundry.management.washbatch.domain.WashBatchStatus.CANCELLED and di.removalReason=com.laundry.management.washbatch.domain.WashBatchItemRemovalReason.BATCH_CANCELLED) or (b.status<>com.laundry.management.washbatch.domain.WashBatchStatus.CANCELLED and di.removedAt is null)) and di.orderItem.order.promisedAt is not null and di.orderItem.order.promisedAt<=:dueSoon))
        """)
    Page<WashBatch> search(@Param("branchId") Long branchId,@Param("status") WashBatchStatus status,@Param("search") String search,
        @Param("serviceId") Long serviceId,@Param("createdBy") Long createdBy,@Param("createdFrom") java.time.Instant createdFrom,@Param("createdTo") java.time.Instant createdTo,
        @Param("privateOnly") boolean privateOnly,@Param("sharedOnly") boolean sharedOnly,@Param("notesOnly") boolean notesOnly,
        @Param("mixedOnly") boolean mixedOnly,@Param("priorityOnly") boolean priorityOnly,@Param("dueSoonOnly") boolean dueSoonOnly,
        @Param("dueSoon") java.time.Instant dueSoon,Pageable pageable);

    @Query("select distinct b.createdBy from WashBatch b where b.branch.id=:branchId order by b.createdBy.displayName,b.createdBy.id")
    List<UserAccount> findCreators(@Param("branchId") Long branchId);

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
