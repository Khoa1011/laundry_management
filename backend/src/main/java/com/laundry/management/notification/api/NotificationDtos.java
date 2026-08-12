package com.laundry.management.notification.api;

import com.laundry.management.notification.application.CreateNotificationCommand;
import com.laundry.management.notification.domain.NotificationAudienceType;
import com.laundry.management.notification.domain.NotificationReferenceType;
import com.laundry.management.notification.domain.NotificationSeverity;
import com.laundry.management.notification.domain.NotificationSoundKey;
import com.laundry.management.notification.domain.NotificationType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class NotificationDtos {
    private NotificationDtos() {
    }

    public enum ListStatus {
        ALL,
        UNREAD,
        READ
    }

    public record ItemResponse(
        Long id,
        NotificationType type,
        NotificationSeverity severity,
        String titleKey,
        String messageKey,
        String titleFallback,
        String messageFallback,
        Map<String, Object> metadata,
        Long branchId,
        NotificationReferenceType referenceType,
        String referenceId,
        String deepLink,
        Instant createdAt,
        Instant readAt,
        boolean unread
    ) {
    }

    public record PageResponse(
        List<ItemResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean hasNext,
        long unreadCount
    ) {
    }

    public record UnreadCountResponse(long unreadCount) {
    }

    public record MutationResponse(Long notificationId, int updated, long unreadCount) {
    }

    public record PreferenceResponse(
        boolean soundEnabled,
        NotificationSoundKey soundKey,
        int soundVolume,
        boolean toastEnabled,
        boolean bellAnimationEnabled,
        long version
    ) {
    }

    public record PreferenceUpdateRequest(
        boolean soundEnabled,
        @NotNull NotificationSoundKey soundKey,
        @Min(0) @Max(100) int soundVolume,
        boolean toastEnabled,
        boolean bellAnimationEnabled
    ) {
    }

    public record SendRequest(
        @NotNull NotificationType type,
        @NotNull NotificationSeverity severity,
        @NotBlank @Size(max = 180) String titleKey,
        @NotBlank @Size(max = 180) String messageKey,
        @NotBlank @Size(max = 250) String titleFallback,
        @NotBlank @Size(max = 1000) String messageFallback,
        Map<String, Object> metadata,
        @NotNull NotificationAudienceType audienceType,
        @Size(max = 100) Set<Long> targetUserIds,
        @Size(max = 100) Set<Long> targetEmployeeIds,
        @Size(max = 100) Set<Long> targetPositionIds,
        @Size(max = 100) String targetPermissionCode,
        @NotNull Long branchId,
        @NotNull Boolean excludeActor,
        NotificationReferenceType referenceType,
        @Size(max = 100) String referenceId,
        @Size(max = 500) String deepLink,
        @Size(max = 190) String deduplicationKey,
        Instant expiresAt
    ) {
        public CreateNotificationCommand toCommand(Long actorUserId) {
            return CreateNotificationCommand.builder()
                .type(type)
                .severity(severity)
                .titleKey(titleKey)
                .messageKey(messageKey)
                .titleFallback(titleFallback)
                .messageFallback(messageFallback)
                .metadata(metadata)
                .audienceType(audienceType)
                .targetUserIds(targetUserIds)
                .targetEmployeeIds(targetEmployeeIds)
                .targetPositionIds(targetPositionIds)
                .targetPermissionCode(targetPermissionCode)
                .branchId(branchId)
                .actorUserId(actorUserId)
                .excludeActor(excludeActor.booleanValue())
                .referenceType(referenceType)
                .referenceId(referenceId)
                .deepLink(deepLink)
                .deduplicationKey(deduplicationKey)
                .expiresAt(expiresAt)
                .createdBySystem(false)
                .build();
        }
    }

    public record SendResponse(Long notificationId, int recipientCount, boolean created) {
    }
}
