package com.laundry.management.notification.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_type", nullable = false, length = 60)
    private NotificationType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NotificationSeverity severity;

    @Column(name = "title_key", nullable = false, length = 180)
    private String titleKey;

    @Column(name = "message_key", nullable = false, length = 180)
    private String messageKey;

    @Column(name = "title_fallback", nullable = false, length = 250)
    private String titleFallback;

    @Column(name = "message_fallback", nullable = false, length = 1000)
    private String messageFallback;

    @Column(name = "metadata_json", columnDefinition = "TEXT")
    private String metadataJson;

    @Column(name = "branch_id")
    private Long branchId;

    @Column(name = "actor_user_id")
    private Long actorUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "audience_type", nullable = false, length = 60)
    private NotificationAudienceType audienceType;

    @Enumerated(EnumType.STRING)
    @Column(name = "reference_type", length = 40)
    private NotificationReferenceType referenceType;

    @Column(name = "reference_id", length = 100)
    private String referenceId;

    @Column(name = "deep_link", length = 500)
    private String deepLink;

    @Column(name = "exclude_actor", nullable = false)
    private boolean excludeActor;

    @Column(name = "deduplication_key", length = 190)
    private String deduplicationKey;

    @Column(name = "created_by_system", nullable = false)
    private boolean createdBySystem;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by")
    private Long createdBy;

    protected Notification() {
    }

    public Notification(
        NotificationType type,
        NotificationSeverity severity,
        String titleKey,
        String messageKey,
        String titleFallback,
        String messageFallback,
        String metadataJson,
        Long branchId,
        Long actorUserId,
        NotificationAudienceType audienceType,
        NotificationReferenceType referenceType,
        String referenceId,
        String deepLink,
        boolean excludeActor,
        String deduplicationKey,
        boolean createdBySystem,
        Instant expiresAt
    ) {
        this.type = type;
        this.severity = severity;
        this.titleKey = titleKey;
        this.messageKey = messageKey;
        this.titleFallback = titleFallback;
        this.messageFallback = messageFallback;
        this.metadataJson = metadataJson;
        this.branchId = branchId;
        this.actorUserId = actorUserId;
        this.audienceType = audienceType;
        this.referenceType = referenceType;
        this.referenceId = referenceId;
        this.deepLink = deepLink;
        this.excludeActor = excludeActor;
        this.deduplicationKey = deduplicationKey;
        this.createdBySystem = createdBySystem;
        this.expiresAt = expiresAt;
        this.createdBy = actorUserId;
    }

    public Long getId() { return id; }
    public NotificationType getType() { return type; }
    public NotificationSeverity getSeverity() { return severity; }
    public String getTitleKey() { return titleKey; }
    public String getMessageKey() { return messageKey; }
    public String getTitleFallback() { return titleFallback; }
    public String getMessageFallback() { return messageFallback; }
    public String getMetadataJson() { return metadataJson; }
    public Long getBranchId() { return branchId; }
    public Long getActorUserId() { return actorUserId; }
    public NotificationAudienceType getAudienceType() { return audienceType; }
    public NotificationReferenceType getReferenceType() { return referenceType; }
    public String getReferenceId() { return referenceId; }
    public String getDeepLink() { return deepLink; }
    public boolean isExcludeActor() { return excludeActor; }
    public String getDeduplicationKey() { return deduplicationKey; }
    public boolean isCreatedBySystem() { return createdBySystem; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getCreatedAt() { return createdAt; }
}
