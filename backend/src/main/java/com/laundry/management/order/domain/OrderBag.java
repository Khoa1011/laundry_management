package com.laundry.management.order.domain;

import com.laundry.management.auth.domain.UserAccount;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.Locale;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "order_bags")
public class OrderBag {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "order_id") private LaundryOrder order;
    @Column(name = "bag_code", nullable = false, unique = true, length = 64) private String bagCode;
    @Column(name = "sequence_number", nullable = false) private int sequenceNumber;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private OrderBagStatus status;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "created_by", updatable = false) private UserAccount createdBy;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "updated_by") private UserAccount updatedBy;
    @Column(name = "last_print_requested_at") private Instant lastPrintRequestedAt;
    @Column(name = "print_request_count", nullable = false) private int printRequestCount;
    @Column(name = "voided_at") private Instant voidedAt;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "voided_by") private UserAccount voidedBy;
    @Column(name = "void_reason", length = 500) private String voidReason;
    @Column(name = "sorted_at") private Instant sortedAt;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "sorted_by") private UserAccount sortedBy;
    @Version @Column(nullable = false) private long version;

    protected OrderBag() {}

    public OrderBag(LaundryOrder order, int sequenceNumber, UserAccount actor) {
        this.order = order;
        this.sequenceNumber = sequenceNumber;
        this.bagCode = order.getOrderCode() + "-" + String.format(Locale.ROOT, "%02d", sequenceNumber);
        this.status = OrderBagStatus.RECEIVED;
        this.createdBy = actor;
        this.updatedBy = actor;
    }

    public void recordPrintRequest(UserAccount actor, Instant at) {
        this.printRequestCount++;
        this.lastPrintRequestedAt = at;
        this.updatedBy = actor;
    }

    public void voidBag(UserAccount actor, Instant at, String reason) {
        this.status = OrderBagStatus.VOIDED;
        this.voidedAt = at;
        this.voidedBy = actor;
        this.voidReason = reason;
        this.updatedBy = actor;
    }

    public void markSorted(UserAccount actor, Instant at) {
        this.status = OrderBagStatus.SORTED;
        this.sortedAt = at;
        this.sortedBy = actor;
        this.updatedBy = actor;
    }

    public void reopenSorting(UserAccount actor) {
        this.status = OrderBagStatus.RECEIVED;
        this.sortedAt = null;
        this.sortedBy = null;
        this.updatedBy = actor;
    }

    public Long getId() { return id; }
    public LaundryOrder getOrder() { return order; }
    public String getBagCode() { return bagCode; }
    public int getSequenceNumber() { return sequenceNumber; }
    public OrderBagStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getLastPrintRequestedAt() { return lastPrintRequestedAt; }
    public int getPrintRequestCount() { return printRequestCount; }
    public Instant getVoidedAt() { return voidedAt; }
    public UserAccount getVoidedBy() { return voidedBy; }
    public String getVoidReason() { return voidReason; }
    public Instant getSortedAt() { return sortedAt; }
    public UserAccount getSortedBy() { return sortedBy; }
    public long getVersion() { return version; }
}
