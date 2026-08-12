package com.laundry.management.notification.realtime;

import com.laundry.management.notification.application.NotificationCreatedEvent;
import com.laundry.management.notification.application.NotificationStateChangedEvent;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class NotificationRealtimeEventListener {
    private static final Logger LOGGER = LoggerFactory.getLogger(NotificationRealtimeEventListener.class);
    private final NotificationSseService sseService;
    private final Timer deliveryLatency;

    public NotificationRealtimeEventListener(
        NotificationSseService sseService,
        MeterRegistry meterRegistry
    ) {
        this.sseService = sseService;
        this.deliveryLatency = Timer.builder("notification.sse.delivery.latency")
            .description("Delay between notification persistence and SSE dispatch")
            .register(meterRegistry);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCreated(NotificationCreatedEvent event) {
        try {
            sseService.dispatchCreated(event);
            if (event.notification().createdAt() != null) {
                deliveryLatency.record(Duration.between(event.notification().createdAt(), Instant.now()));
            }
        } catch (RuntimeException exception) {
            LOGGER.warn("Notification {} committed but realtime delivery failed", event.notificationId());
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onStateChanged(NotificationStateChangedEvent event) {
        try {
            sseService.dispatchStateChanged(event);
        } catch (RuntimeException exception) {
            LOGGER.warn("Notification state committed but realtime delivery failed for user {}", event.userId());
        }
    }
}
