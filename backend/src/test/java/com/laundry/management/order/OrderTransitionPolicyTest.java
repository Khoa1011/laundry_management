package com.laundry.management.order;

import static org.assertj.core.api.Assertions.assertThat;
import com.laundry.management.order.application.OrderTransitionPolicy;
import com.laundry.management.order.domain.OrderStatus;
import org.junit.jupiter.api.Test;

class OrderTransitionPolicyTest {
    private final OrderTransitionPolicy policy = new OrderTransitionPolicy();
    @Test void permitsOnlyTheDocumentedLifecycle() {
        assertThat(policy.canMove(OrderStatus.RECEIVED,OrderStatus.PROCESSING)).isTrue();
        assertThat(policy.canMove(OrderStatus.PROCESSING,OrderStatus.READY)).isTrue();
        assertThat(policy.canMove(OrderStatus.READY,OrderStatus.COMPLETED)).isTrue();
        assertThat(policy.canMove(OrderStatus.COMPLETED,OrderStatus.REOPENED)).isTrue();
        assertThat(policy.canMove(OrderStatus.REOPENED,OrderStatus.PROCESSING)).isTrue();
        assertThat(policy.canMove(OrderStatus.REOPENED,OrderStatus.READY)).isTrue();
        assertThat(policy.canMove(OrderStatus.CANCELLED,OrderStatus.REOPENED)).isFalse();
        assertThat(policy.canMove(OrderStatus.RECEIVED,OrderStatus.COMPLETED)).isFalse();
    }
}
