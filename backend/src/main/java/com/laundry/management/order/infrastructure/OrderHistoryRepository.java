package com.laundry.management.order.infrastructure;

import com.laundry.management.order.domain.OrderStatusHistory;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderHistoryRepository extends JpaRepository<OrderStatusHistory, Long> {
    @EntityGraph(attributePaths="actor")
    List<OrderStatusHistory> findByOrderIdOrderByCreatedAtDescIdDesc(Long orderId);
}
