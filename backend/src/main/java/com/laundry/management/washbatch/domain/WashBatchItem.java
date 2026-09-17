package com.laundry.management.washbatch.domain;

import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.order.domain.OrderItem;
import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name="wash_batch_items")
public class WashBatchItem {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="wash_batch_id") private WashBatch batch;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="order_item_id") private OrderItem orderItem;
    @CreationTimestamp @Column(name="added_at",nullable=false,updatable=false) private Instant addedAt;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="added_by",updatable=false) private UserAccount addedBy;
    @Column(name="removed_at") private Instant removedAt;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="removed_by") private UserAccount removedBy;
    protected WashBatchItem() {}
    public WashBatchItem(WashBatch batch,OrderItem item,UserAccount actor){this.batch=batch;this.orderItem=item;this.addedBy=actor;}
    public void remove(UserAccount actor,Instant now){if(removedAt==null){removedAt=now;removedBy=actor;}}
    public boolean isActive(){return removedAt==null;} public Long getId(){return id;} public WashBatch getBatch(){return batch;} public OrderItem getOrderItem(){return orderItem;}
    public Instant getAddedAt(){return addedAt;} public UserAccount getAddedBy(){return addedBy;} public Instant getRemovedAt(){return removedAt;} public UserAccount getRemovedBy(){return removedBy;}
}
