package com.laundry.management.notification.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.notification.api.NotificationDtos;
import com.laundry.management.notification.domain.Notification;
import com.laundry.management.notification.domain.NotificationRecipient;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class NotificationMapper {
    private static final TypeReference<Map<String, Object>> METADATA_TYPE = new TypeReference<>() {};
    private final ObjectMapper objectMapper;

    public NotificationMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public NotificationDtos.ItemResponse toItem(NotificationRecipient recipient) {
        return toItem(recipient.getNotification(), recipient.getReadAt());
    }

    public NotificationDtos.ItemResponse toNewItem(Notification notification) {
        return toItem(notification, null);
    }

    private NotificationDtos.ItemResponse toItem(Notification notification, java.time.Instant readAt) {
        return new NotificationDtos.ItemResponse(
            notification.getId(),
            notification.getType(),
            notification.getSeverity(),
            notification.getTitleKey(),
            notification.getMessageKey(),
            notification.getTitleFallback(),
            notification.getMessageFallback(),
            metadata(notification.getMetadataJson()),
            notification.getBranchId(),
            notification.getReferenceType(),
            notification.getReferenceId(),
            notification.getDeepLink(),
            notification.getCreatedAt(),
            readAt,
            readAt == null
        );
    }

    private Map<String, Object> metadata(String value) {
        if (value == null || value.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(value, METADATA_TYPE);
        } catch (Exception ignored) {
            return Map.of();
        }
    }
}
