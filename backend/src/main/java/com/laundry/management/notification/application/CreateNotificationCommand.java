package com.laundry.management.notification.application;

import com.laundry.management.notification.domain.NotificationAudienceType;
import com.laundry.management.notification.domain.NotificationReferenceType;
import com.laundry.management.notification.domain.NotificationSeverity;
import com.laundry.management.notification.domain.NotificationType;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.Collections;
import java.util.LinkedHashMap;

public record CreateNotificationCommand(
    NotificationType type,
    NotificationSeverity severity,
    String titleKey,
    String messageKey,
    String titleFallback,
    String messageFallback,
    Map<String, Object> metadata,
    NotificationAudienceType audienceType,
    Set<Long> targetUserIds,
    Set<Long> targetEmployeeIds,
    Set<Long> targetPositionIds,
    String targetPermissionCode,
    Long branchId,
    Long actorUserId,
    boolean excludeActor,
    NotificationReferenceType referenceType,
    String referenceId,
    String deepLink,
    String deduplicationKey,
    Instant expiresAt,
    boolean createdBySystem
) {
    public CreateNotificationCommand {
        metadata = metadata == null
            ? Map.of()
            : Collections.unmodifiableMap(new LinkedHashMap<>(metadata));
        targetUserIds = targetUserIds == null ? Set.of() : Set.copyOf(targetUserIds);
        targetEmployeeIds = targetEmployeeIds == null ? Set.of() : Set.copyOf(targetEmployeeIds);
        targetPositionIds = targetPositionIds == null ? Set.of() : Set.copyOf(targetPositionIds);
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {
        private NotificationType type;
        private NotificationSeverity severity = NotificationSeverity.INFO;
        private String titleKey;
        private String messageKey;
        private String titleFallback;
        private String messageFallback;
        private Map<String, Object> metadata = Map.of();
        private NotificationAudienceType audienceType;
        private Set<Long> targetUserIds = Set.of();
        private Set<Long> targetEmployeeIds = Set.of();
        private Set<Long> targetPositionIds = Set.of();
        private String targetPermissionCode;
        private Long branchId;
        private Long actorUserId;
        private boolean excludeActor = true;
        private NotificationReferenceType referenceType;
        private String referenceId;
        private String deepLink;
        private String deduplicationKey;
        private Instant expiresAt;
        private boolean createdBySystem;

        public Builder type(NotificationType value) { type = value; return this; }
        public Builder severity(NotificationSeverity value) { severity = value; return this; }
        public Builder titleKey(String value) { titleKey = value; return this; }
        public Builder messageKey(String value) { messageKey = value; return this; }
        public Builder titleFallback(String value) { titleFallback = value; return this; }
        public Builder messageFallback(String value) { messageFallback = value; return this; }
        public Builder metadata(Map<String, Object> value) { metadata = value; return this; }
        public Builder audienceType(NotificationAudienceType value) { audienceType = value; return this; }
        public Builder targetUserIds(Set<Long> value) { targetUserIds = value; return this; }
        public Builder targetEmployeeIds(Set<Long> value) { targetEmployeeIds = value; return this; }
        public Builder targetPositionIds(Set<Long> value) { targetPositionIds = value; return this; }
        public Builder targetPermissionCode(String value) { targetPermissionCode = value; return this; }
        public Builder branchId(Long value) { branchId = value; return this; }
        public Builder actorUserId(Long value) { actorUserId = value; return this; }
        public Builder excludeActor(boolean value) { excludeActor = value; return this; }
        public Builder referenceType(NotificationReferenceType value) { referenceType = value; return this; }
        public Builder referenceId(String value) { referenceId = value; return this; }
        public Builder deepLink(String value) { deepLink = value; return this; }
        public Builder deduplicationKey(String value) { deduplicationKey = value; return this; }
        public Builder expiresAt(Instant value) { expiresAt = value; return this; }
        public Builder createdBySystem(boolean value) { createdBySystem = value; return this; }

        public CreateNotificationCommand build() {
            return new CreateNotificationCommand(
                type, severity, titleKey, messageKey, titleFallback, messageFallback, metadata,
                audienceType, targetUserIds, targetEmployeeIds, targetPositionIds,
                targetPermissionCode, branchId, actorUserId, excludeActor, referenceType,
                referenceId, deepLink, deduplicationKey, expiresAt, createdBySystem
            );
        }
    }
}
