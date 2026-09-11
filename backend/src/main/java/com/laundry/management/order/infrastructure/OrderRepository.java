package com.laundry.management.order.infrastructure;

import com.laundry.management.order.domain.LaundryOrder;
import com.laundry.management.order.domain.OrderStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<LaundryOrder, Long> {
    @EntityGraph(attributePaths={"branch","customer","createdBy","updatedBy"})
    @Query("""
        select o from LaundryOrder o
        where o.branch.id=:branchId
          and (:status is null or o.status=:status)
          and (:fromAt is null or o.createdAt>=:fromAt)
          and (:toAt is null or o.createdAt<:toAt)
          and (:search is null or lower(o.orderCode) like :search escape '!'
            or lower(coalesce(o.customerNameSnapshot,'')) like :search escape '!'
            or lower(coalesce(o.customerPhoneSnapshot,'')) like :search escape '!'
            or exists (select i.id from OrderItem i where i.order=o and lower(i.serviceNameSnapshot) like :search escape '!'))
        """)
    Page<LaundryOrder> search(@Param("branchId") Long branchId, @Param("status") OrderStatus status,
        @Param("search") String search, @Param("fromAt") Instant fromAt, @Param("toAt") Instant toAt, Pageable pageable);

    @EntityGraph(attributePaths={"branch","customer","createdBy","updatedBy","items","cancelledBy","reopenedBy"})
    Optional<LaundryOrder> findByIdAndBranchId(Long id, Long branchId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths={"branch","customer"})
    @Query("select o from LaundryOrder o where o.id=:id and o.branch.id=:branchId")
    Optional<LaundryOrder> findForUpdate(@Param("id") Long id, @Param("branchId") Long branchId);
}
