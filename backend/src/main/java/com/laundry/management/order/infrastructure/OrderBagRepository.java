package com.laundry.management.order.infrastructure;

import com.laundry.management.order.domain.OrderBag;
import com.laundry.management.order.domain.OrderBagStatus;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderBagRepository extends JpaRepository<OrderBag, Long> {
    List<OrderBag> findByOrderIdOrderBySequenceNumberAsc(Long orderId);
    Optional<OrderBag> findByBagCodeAndOrderBranchId(String bagCode, Long branchId);
    Optional<OrderBag> findByIdAndOrderBranchId(Long id, Long branchId);
    Optional<OrderBag> findFirstByOrderIdOrderBySequenceNumberDesc(Long orderId);
    long countByOrderIdAndStatus(Long orderId, OrderBagStatus status);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from OrderBag b where b.id = :id and b.order.id = :orderId")
    Optional<OrderBag> findForUpdate(@Param("id") Long id, @Param("orderId") Long orderId);
}
