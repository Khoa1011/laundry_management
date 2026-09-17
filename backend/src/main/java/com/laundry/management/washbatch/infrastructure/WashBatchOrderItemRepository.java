package com.laundry.management.washbatch.infrastructure;

import com.laundry.management.order.domain.*;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface WashBatchOrderItemRepository extends org.springframework.data.repository.Repository<OrderItem,Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths={"order","order.branch","order.customer","service","itemType"})
    @Query("select i from OrderItem i where i.id in :ids order by i.id")
    List<OrderItem> lockOrderItems(@Param("ids") Collection<Long> ids);

    @EntityGraph(attributePaths={"order","order.branch","order.customer","service","itemType"})
    @Query("""
        select i from OrderItem i where i.order.branch.id=:branchId and i.order.status=:status
          and not exists (select a.orderItemId from WashBatchActiveItem a where a.orderItem=i)
          and (:serviceId is null or i.service.id=:serviceId)
          and (:search is null or lower(i.order.orderCode) like :search escape '!'
            or lower(coalesce(i.order.customerNameSnapshot,'')) like :search escape '!'
            or lower(coalesce(i.order.customerPhoneSnapshot,'')) like :search escape '!')
        order by i.order.promisedAt asc,i.id asc
        """)
    Page<OrderItem> findCandidates(@Param("branchId") Long branchId,@Param("status") OrderStatus status,
        @Param("serviceId") Long serviceId,@Param("search") String search,Pageable pageable);

    @Query("""
        select count(i) from OrderItem i where i.order.branch.id=:branchId and i.order.status=:status
          and not exists (select a.orderItemId from WashBatchActiveItem a where a.orderItem=i)
        """)
    long countCandidates(@Param("branchId") Long branchId,@Param("status") OrderStatus status);
}
