package com.laundry.management.notification.realtime;

import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.notification.application.NotificationCreatedEvent;
import com.laundry.management.notification.application.NotificationStateChangedEvent;
import com.laundry.management.notification.infrastructure.NotificationRecipientRepository;
import java.time.Instant;
import java.time.Duration;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class NotificationSseService {
    private final NotificationConnectionRegistry registry;
    private final NotificationRecipientRepository recipientRepository;
    private final CurrentUserProvider currentUserProvider;
    private final AtomicLong eventSequence = new AtomicLong(System.currentTimeMillis());

    public NotificationSseService(
        NotificationConnectionRegistry registry,
        NotificationRecipientRepository recipientRepository,
        CurrentUserProvider currentUserProvider
    ) {
        this.registry = registry;
        this.recipientRepository = recipientRepository;
        this.currentUserProvider = currentUserProvider;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).NOTIFICATION_READ_OWN)")
    @Transactional(readOnly = true)
    public SseEmitter connect() {
        Long userId = currentUserProvider.getRequired().id();
        long unreadCount = recipientRepository.countUnread(userId, Instant.now());
        String eventId = nextEventId();
        NotificationSseEnvelope payload = new NotificationSseEnvelope(
            eventId,
            "connected",
            null,
            null,
            unreadCount,
            Instant.now()
        );
        return registry.register(
            userId,
            remainingTokenLifetimeMillis(),
            event("connected", eventId, payload)
        );
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public void dispatchCreated(NotificationCreatedEvent event) {
        Map<Long, Long> unreadCounts = unreadCounts(event.recipientUserIds());
        for (Long userId : event.recipientUserIds()) {
            long unreadCount = unreadCounts.getOrDefault(userId, 0L);
            String eventId = nextEventId();
            send(userId, "notification.created", new NotificationSseEnvelope(
                eventId,
                "notification.created",
                event.notification(),
                event.notificationId(),
                unreadCount,
                Instant.now()
            ));
            send(userId, "notification.unread-count", new NotificationSseEnvelope(
                nextEventId(),
                "notification.unread-count",
                null,
                event.notificationId(),
                unreadCount,
                Instant.now()
            ));
        }
    }

    public void dispatchStateChanged(NotificationStateChangedEvent event) {
        send(event.userId(), event.eventName(), new NotificationSseEnvelope(
            nextEventId(),
            event.eventName(),
            null,
            event.notificationId(),
            event.unreadCount(),
            Instant.now()
        ));
        send(event.userId(), "notification.unread-count", new NotificationSseEnvelope(
            nextEventId(),
            "notification.unread-count",
            null,
            event.notificationId(),
            event.unreadCount(),
            Instant.now()
        ));
    }

    public void heartbeat() {
        String eventId = nextEventId();
        registry.heartbeat(event("heartbeat", eventId, new NotificationSseEnvelope(
            eventId,
            "heartbeat",
            null,
            null,
            null,
            Instant.now()
        )));
    }

    public void disconnectUser(Long userId) {
        registry.disconnectUser(userId);
    }

    private Map<Long, Long> unreadCounts(Collection<Long> userIds) {
        Map<Long, Long> counts = new HashMap<>();
        if (userIds.isEmpty()) {
            return counts;
        }
        for (Object[] row : recipientRepository.countUnreadByUserIds(userIds, Instant.now())) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        return counts;
    }

    private void send(Long userId, String eventName, NotificationSseEnvelope payload) {
        registry.sendToUser(userId, event(eventName, payload.eventId(), payload));
    }

    private SseEmitter.SseEventBuilder event(String name, String id, Object data) {
        return SseEmitter.event().name(name).id(id).data(data);
    }

    private String nextEventId() {
        return Long.toString(eventSequence.incrementAndGet());
    }

    private long remainingTokenLifetimeMillis() {
        Object credentials = SecurityContextHolder.getContext().getAuthentication().getCredentials();
        if (credentials instanceof Jwt jwt && jwt.getExpiresAt() != null) {
            return Math.max(1_000L, Duration.between(Instant.now(), jwt.getExpiresAt()).toMillis());
        }
        return 15 * 60 * 1000L;
    }
}
