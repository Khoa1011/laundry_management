package com.laundry.management.order.application;

import com.laundry.management.order.domain.OrderStatus;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class OrderTransitionPolicy {
    private static final Map<OrderStatus, Set<OrderStatus>> ALLOWED = Map.of(
        OrderStatus.RECEIVED, Set.of(OrderStatus.PROCESSING, OrderStatus.CANCELLED),
        OrderStatus.PROCESSING, Set.of(OrderStatus.READY, OrderStatus.CANCELLED),
        OrderStatus.READY, Set.of(OrderStatus.COMPLETED, OrderStatus.CANCELLED),
        OrderStatus.COMPLETED, Set.of(OrderStatus.REOPENED),
        OrderStatus.CANCELLED, Set.of(),
        OrderStatus.REOPENED, Set.of(OrderStatus.PROCESSING, OrderStatus.READY)
    );
    public boolean canMove(OrderStatus from, OrderStatus to) { return ALLOWED.getOrDefault(from, Set.of()).contains(to); }
}
