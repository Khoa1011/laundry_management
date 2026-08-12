package com.laundry.management.notification.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "notification_recipients")
public class NotificationRecipient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "notification_id", nullable = false)
    private Notification notification;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "delivered_at")
    private Instant deliveredAt;

    @Column(name = "seen_at")
    private Instant seenAt;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "dismissed_at")
    private Instant dismissedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected NotificationRecipient() {
    }

    public NotificationRecipient(Notification notification, Long userId) {
        this.notification = notification;
        this.userId = userId;
    }

    public Long getId() { return id; }
    public Notification getNotification() { return notification; }
    public Long getUserId() { return userId; }
    public Instant getDeliveredAt() { return deliveredAt; }
    public Instant getSeenAt() { return seenAt; }
    public Instant getReadAt() { return readAt; }
    public Instant getDismissedAt() { return dismissedAt; }
    public Instant getCreatedAt() { return createdAt; }
}
