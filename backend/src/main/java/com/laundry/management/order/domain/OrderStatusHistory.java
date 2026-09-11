package com.laundry.management.order.domain;

import com.laundry.management.auth.domain.UserAccount;
import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name="order_status_history")
public class OrderStatusHistory {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="order_id") private LaundryOrder order;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=40) private OrderHistoryAction action;
    @Enumerated(EnumType.STRING) @Column(name="from_status", length=30) private OrderStatus fromStatus;
    @Enumerated(EnumType.STRING) @Column(name="to_status", length=30) private OrderStatus toStatus;
    @Column(length=500) private String reason;
    @Column(name="changed_fields_json", columnDefinition="TEXT") private String changedFieldsJson;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=30) private OrderStatusSource source;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="actor_user_id") private UserAccount actor;
    @CreationTimestamp @Column(name="created_at", nullable=false, updatable=false) private Instant createdAt;
    protected OrderStatusHistory() {}
    public OrderStatusHistory(LaundryOrder order, OrderHistoryAction action, OrderStatus from, OrderStatus to,
                              String reason, String changed, OrderStatusSource source, UserAccount actor) {
        this.order=order; this.action=action; this.fromStatus=from; this.toStatus=to; this.reason=reason;
        this.changedFieldsJson=changed; this.source=source; this.actor=actor;
    }
    public Long getId(){return id;} public OrderHistoryAction getAction(){return action;} public OrderStatus getFromStatus(){return fromStatus;}
    public OrderStatus getToStatus(){return toStatus;} public String getReason(){return reason;} public String getChangedFieldsJson(){return changedFieldsJson;}
    public OrderStatusSource getSource(){return source;} public UserAccount getActor(){return actor;} public Instant getCreatedAt(){return createdAt;}
}
