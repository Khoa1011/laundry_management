package com.laundry.management.notification.application;

public record NotificationStateChangedEvent(
    Long userId,
    String eventName,
    Long notificationId,
    long unreadCount
) {
}
