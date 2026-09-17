package com.laundry.management.order.domain;

import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.customer.domain.Customer;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "orders")
public class LaundryOrder {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name="order_code", nullable=false, unique=true, length=50) private String orderCode;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="branch_id") private Branch branch;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="customer_id") private Customer customer;
    @Column(name="customer_name_snapshot", length=150) private String customerNameSnapshot;
    @Column(name="customer_phone_snapshot", length=30) private String customerPhoneSnapshot;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=30) private OrderStatus status;
    @Column(name="promised_at") private Instant promisedAt;
    @Column(length=2000) private String note;
    @Column(nullable=false, length=3) private String currency;
    @Column(name="total_amount", nullable=false, precision=18, scale=2) private BigDecimal totalAmount;
    @OneToMany(mappedBy="order", cascade=CascadeType.ALL, orphanRemoval=true) @BatchSize(size=50)
    @OrderBy("id asc") private List<OrderItem> items = new ArrayList<>();
    @CreationTimestamp @Column(name="created_at", nullable=false, updatable=false) private Instant createdAt;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="created_by", updatable=false) private UserAccount createdBy;
    @UpdateTimestamp @Column(name="updated_at", nullable=false) private Instant updatedAt;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="updated_by") private UserAccount updatedBy;
    @Column(name="cancelled_at") private Instant cancelledAt;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="cancelled_by") private UserAccount cancelledBy;
    @Column(name="cancel_reason", length=500) private String cancelReason;
    @Column(name="reopened_at") private Instant reopenedAt;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="reopened_by") private UserAccount reopenedBy;
    @Column(name="reopen_reason", length=500) private String reopenReason;
    @Version @Column(nullable=false) private long version;

    protected LaundryOrder() {}
    public LaundryOrder(String code, Branch branch, Customer customer, String name, String phone,
                        Instant promisedAt, String note, String currency, UserAccount actor) {
        this.orderCode=code; this.branch=branch; this.customer=customer;
        this.customerNameSnapshot=name; this.customerPhoneSnapshot=phone;
        this.status=OrderStatus.RECEIVED; this.promisedAt=promisedAt; this.note=note;
        this.currency=currency; this.totalAmount=BigDecimal.ZERO; this.createdBy=actor; this.updatedBy=actor;
    }
    public void addItem(OrderItem item) { items.add(item); item.attach(this); recalculate(); }
    public void replaceItems(List<OrderItem> replacements, String currency, UserAccount actor) {
        items.clear(); this.currency=currency; replacements.forEach(this::addItem); this.updatedBy=actor; recalculate();
    }
    public void updatePromisedAt(Instant value, UserAccount actor) { this.promisedAt=value; this.updatedBy=actor; }
    public void updateNote(String value, UserAccount actor) { this.note=value; this.updatedBy=actor; }
    public void touch(UserAccount actor, Instant changedAt) { this.updatedBy=actor; this.updatedAt=changedAt; }
    public void transition(OrderStatus target, UserAccount actor, String reason) {
        this.status=target; this.updatedBy=actor;
        if (target == OrderStatus.CANCELLED) { this.cancelledAt=Instant.now(); this.cancelledBy=actor; this.cancelReason=reason; }
        if (target == OrderStatus.REOPENED) { this.reopenedAt=Instant.now(); this.reopenedBy=actor; this.reopenReason=reason; }
    }
    private void recalculate() { totalAmount=items.stream().map(OrderItem::getLineAmount).reduce(BigDecimal.ZERO, BigDecimal::add); }
    public Long getId(){return id;} public String getOrderCode(){return orderCode;} public Branch getBranch(){return branch;}
    public Customer getCustomer(){return customer;} public String getCustomerNameSnapshot(){return customerNameSnapshot;}
    public String getCustomerPhoneSnapshot(){return customerPhoneSnapshot;} public OrderStatus getStatus(){return status;}
    public Instant getPromisedAt(){return promisedAt;} public String getNote(){return note;} public String getCurrency(){return currency;}
    public BigDecimal getTotalAmount(){return totalAmount;} public List<OrderItem> getItems(){return List.copyOf(items);}
    public Instant getCreatedAt(){return createdAt;} public UserAccount getCreatedBy(){return createdBy;}
    public Instant getUpdatedAt(){return updatedAt;} public UserAccount getUpdatedBy(){return updatedBy;} public long getVersion(){return version;}
    public Instant getCancelledAt(){return cancelledAt;} public UserAccount getCancelledBy(){return cancelledBy;} public String getCancelReason(){return cancelReason;}
    public Instant getReopenedAt(){return reopenedAt;} public UserAccount getReopenedBy(){return reopenedBy;} public String getReopenReason(){return reopenReason;}
}
