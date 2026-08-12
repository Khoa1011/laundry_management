package com.laundry.management.notification.realtime;

import com.laundry.management.notification.api.NotificationDtos;
import java.time.Instant;

public record NotificationSseEnvelope(
    String eventId,
    String eventType,
    NotificationDtos.ItemResponse notification,
    Long notificationId,
    Long unreadCount,
    Instant serverTime
) {
}
