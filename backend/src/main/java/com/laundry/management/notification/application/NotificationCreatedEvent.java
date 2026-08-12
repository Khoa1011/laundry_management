package com.laundry.management.notification.application;

import com.laundry.management.notification.api.NotificationDtos;
import java.util.Set;

public record NotificationCreatedEvent(
    Long notificationId,
    Set<Long> recipientUserIds,
    NotificationDtos.ItemResponse notification
) {
}
