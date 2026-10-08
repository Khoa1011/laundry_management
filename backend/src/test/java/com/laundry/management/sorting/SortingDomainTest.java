package com.laundry.management.sorting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.order.domain.LaundryOrder;
import com.laundry.management.order.domain.OrderBag;
import com.laundry.management.order.domain.OrderBagStatus;
import com.laundry.management.order.domain.OrderItem;
import com.laundry.management.sorting.domain.ProcessingGroup;
import com.laundry.management.sorting.domain.SortingAttributes.*;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class SortingDomainTest {
    private final UserAccount actor = mock(UserAccount.class);
    private final LaundryOrder order = mock(LaundryOrder.class);
    private final OrderItem item = mock(OrderItem.class);

    @Test void sortedBagRecordsActorAndTimeThenReopenClearsCurrentMetadata() {
        when(order.getOrderCode()).thenReturn("GS-DH-000125");
        OrderBag bag = new OrderBag(order, 1, actor);
        Instant at = Instant.parse("2026-10-08T10:00:00Z");

        bag.markSorted(actor, at);
        assertThat(bag.getStatus()).isEqualTo(OrderBagStatus.SORTED);
        assertThat(bag.getSortedAt()).isEqualTo(at);
        assertThat(bag.getSortedBy()).isSameAs(actor);

        bag.reopenSorting(actor);
        assertThat(bag.getStatus()).isEqualTo(OrderBagStatus.RECEIVED);
        assertThat(bag.getSortedAt()).isNull();
        assertThat(bag.getSortedBy()).isNull();
    }

    @Test void groupRetainsPhysicalSourceAndVoidAudit() {
        when(order.getOrderCode()).thenReturn("GS-DH-000125");
        OrderBag bag = new OrderBag(order, 2, actor);
        ProcessingGroup group = new ProcessingGroup(bag, item, 3, new BigDecimal("1.200"),
            ColorGroup.DARK, FabricCare.STANDARD, WashMode.NORMAL, TemperatureProfile.T30,
            DetergentProfile.DEFAULT, SoftenerProfile.DEFAULT, HygieneLevel.STANDARD,
            false, DryingInstruction.HANG_DRY, null, actor);
        assertThat(group.getGroupCode()).isEqualTo("GS-DH-000125-02-G03");
        assertThat(group.getBag()).isSameAs(bag);
        assertThat(group.getItem()).isSameAs(item);
        assertThat(group.getStatus()).isEqualTo(GroupStatus.WAITING);

        Instant at = Instant.parse("2026-10-08T11:00:00Z");
        group.voidGroup(actor, at, "Nhầm màu");
        assertThat(group.getStatus()).isEqualTo(GroupStatus.VOIDED);
        assertThat(group.getVoidedAt()).isEqualTo(at);
        assertThat(group.getVoidReason()).isEqualTo("Nhầm màu");
        assertThat(group.getGroupCode()).isEqualTo("GS-DH-000125-02-G03");
    }
}
