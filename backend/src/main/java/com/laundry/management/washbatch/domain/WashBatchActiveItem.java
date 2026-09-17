package com.laundry.management.washbatch.domain;

import com.laundry.management.order.domain.OrderItem;
import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name="wash_batch_active_items")
public class WashBatchActiveItem {
    @Id @Column(name="order_item_id") private Long orderItemId;
    @OneToOne(fetch=FetchType.LAZY,optional=false) @MapsId @JoinColumn(name="order_item_id") private OrderItem orderItem;
    @OneToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="wash_batch_item_id",unique=true) private WashBatchItem membership;
    @CreationTimestamp @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    protected WashBatchActiveItem() {}
    public WashBatchActiveItem(OrderItem orderItem,WashBatchItem membership){this.orderItem=orderItem;this.membership=membership;}
    public Long getOrderItemId(){return orderItemId;} public WashBatchItem getMembership(){return membership;}
}
