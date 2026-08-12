package com.laundry.management.notification.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import java.time.temporal.Temporal;
import java.util.Collection;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class NotificationContentValidator {
    private static final int MAX_METADATA_BYTES = 8_192;
    private static final int MAX_METADATA_DEPTH = 4;
    private static final int MAX_STRING_LENGTH = 500;
    private static final Pattern KEY_PATTERN = Pattern.compile("[A-Za-z][A-Za-z0-9._-]{0,79}");
    private static final Pattern INTERNAL_LINK_PATTERN = Pattern.compile(
        "^/(employees|customers|orders|inventory|payments|finance|deliveries|machines|complaints)/[A-Za-z0-9_-]+$"
            + "|^/notifications(?:/[0-9]+)?$"
    );
    private static final Set<String> SENSITIVE_KEY_PARTS = Set.of(
        "salary", "compensation", "cccd", "citizen", "identitynumber", "password",
        "token", "secret", "storagekey", "documentcontent", "checksum", "privatekey"
    );

    private final ObjectMapper objectMapper;

    public NotificationContentValidator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String validateAndSerialize(CreateNotificationCommand command) {
        require(command.type() != null, "Notification type is required.");
        require(command.severity() != null, "Notification severity is required.");
        requireText(command.titleKey(), 180, "Title translation key is required.");
        requireText(command.messageKey(), 180, "Message translation key is required.");
        requireText(command.titleFallback(), 250, "Title fallback is required.");
        requireText(command.messageFallback(), 1000, "Message fallback is required.");
        require(command.deduplicationKey() == null || command.deduplicationKey().length() <= 190,
            "Deduplication key is too long.");
        require(command.referenceId() == null || command.referenceId().length() <= 100,
            "Reference ID is too long.");
        if (command.deepLink() != null && !INTERNAL_LINK_PATTERN.matcher(command.deepLink()).matches()) {
            throw invalid("Deep link must use a supported internal application route.");
        }
        if (!command.createdBySystem()) {
            require(command.actorUserId() != null, "Notification actor is required.");
            require(command.branchId() != null, "Notification branch is required.");
        }
        validateValue(command.metadata(), 0, null);
        try {
            String json = command.metadata().isEmpty() ? null : objectMapper.writeValueAsString(command.metadata());
            require(json == null || json.getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= MAX_METADATA_BYTES,
                "Notification metadata is too large.");
            return json;
        } catch (JsonProcessingException exception) {
            throw invalid("Notification metadata must be valid structured JSON.");
        }
    }

    private void validateValue(Object value, int depth, String key) {
        require(depth <= MAX_METADATA_DEPTH, "Notification metadata is nested too deeply.");
        if (value == null || value instanceof Number || value instanceof Boolean || value instanceof Temporal) {
            return;
        }
        if (value instanceof String text) {
            require(text.length() <= MAX_STRING_LENGTH, "Notification metadata text is too long.");
            String normalized = text.toLowerCase(Locale.ROOT);
            require(!text.contains("<") && !text.contains(">") && !normalized.contains("javascript:"),
                "Notification metadata must contain plain text only.");
            return;
        }
        if (value instanceof Map<?, ?> map) {
            require(map.size() <= 40, "Notification metadata has too many fields.");
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                require(entry.getKey() instanceof String, "Notification metadata keys must be text.");
                String childKey = (String) entry.getKey();
                require(KEY_PATTERN.matcher(childKey).matches(), "Notification metadata contains an invalid key.");
                String normalizedKey = childKey.replaceAll("[^A-Za-z0-9]", "").toLowerCase(Locale.ROOT);
                require(SENSITIVE_KEY_PARTS.stream().noneMatch(normalizedKey::contains),
                    "Sensitive employee or authentication data is not allowed in notification metadata.");
                validateValue(entry.getValue(), depth + 1, childKey);
            }
            return;
        }
        if (value instanceof Collection<?> collection) {
            require(collection.size() <= 50, "Notification metadata list is too large.");
            collection.forEach(item -> validateValue(item, depth + 1, key));
            return;
        }
        throw invalid("Notification metadata contains an unsupported value.");
    }

    private void requireText(String value, int maxLength, String detail) {
        require(value != null && !value.isBlank() && value.length() <= maxLength, detail);
        require(!value.contains("<") && !value.contains(">"), "Notification content must contain plain text only.");
    }

    private void require(boolean condition, String detail) {
        if (!condition) {
            throw invalid(detail);
        }
    }

    private ApiException invalid(String detail) {
        return new ApiException(
            HttpStatus.BAD_REQUEST,
            ErrorCode.NOTIFICATION_CONTENT_INVALID,
            "Invalid notification content",
            detail
        );
    }
}
