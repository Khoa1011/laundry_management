package com.laundry.management.order.application;

import com.laundry.management.order.domain.OrderStatus;
import java.time.Instant;

public record OrderChangedEvent(Long orderId, String orderCode, Long branchId, OrderStatus status,
                                long version, String eventType, Instant occurredAt) {}
