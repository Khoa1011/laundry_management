package com.laundry.management.notification.realtime;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.DistributionSummary;
import java.io.IOException;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
public class NotificationConnectionRegistry {
    private static final int MAX_CONNECTIONS_PER_USER = 3;
    private static final long EMITTER_TIMEOUT_MILLIS = 15 * 60 * 1000L;

    private final ConcurrentHashMap<Long, CopyOnWriteArrayList<Connection>> connections =
        new ConcurrentHashMap<>();
    private final AtomicInteger activeConnections = new AtomicInteger();
    private final Counter failedSends;
    private final Counter registrations;
    private final DistributionSummary connectionsPerUser;

    public NotificationConnectionRegistry(MeterRegistry meterRegistry) {
        Gauge.builder("notification.sse.connections.active", activeConnections, AtomicInteger::get)
            .description("Active notification SSE connections")
            .register(meterRegistry);
        Gauge.builder("notification.sse.users.active", connections, ConcurrentHashMap::mappingCount)
            .description("Users with an active notification SSE connection")
            .register(meterRegistry);
        this.failedSends = Counter.builder("notification.sse.sends.failed")
            .description("Failed notification SSE sends")
            .register(meterRegistry);
        this.registrations = Counter.builder("notification.sse.connections.registered")
            .description("Notification SSE connection registrations, including reconnects")
            .register(meterRegistry);
        this.connectionsPerUser = DistributionSummary.builder("notification.sse.connections.per.user")
            .description("Active notification SSE connections observed per user at registration")
            .maximumExpectedValue((long) MAX_CONNECTIONS_PER_USER)
            .register(meterRegistry);
    }

    public SseEmitter register(
        Long userId,
        long timeoutMillis,
        SseEmitter.SseEventBuilder connectedEvent
    ) {
        String connectionId = UUID.randomUUID().toString();
        SseEmitter emitter = new SseEmitter(Math.max(1_000L, Math.min(EMITTER_TIMEOUT_MILLIS, timeoutMillis)));
        Connection connection = new Connection(connectionId, emitter, Instant.now());
        CopyOnWriteArrayList<Connection> userConnections =
            connections.computeIfAbsent(userId, ignored -> new CopyOnWriteArrayList<>());
        userConnections.add(connection);
        activeConnections.incrementAndGet();
        registrations.increment();

        emitter.onCompletion(() -> remove(userId, connectionId));
        emitter.onTimeout(() -> {
            remove(userId, connectionId);
            emitter.complete();
        });
        emitter.onError(error -> remove(userId, connectionId));

        if (userConnections.size() > MAX_CONNECTIONS_PER_USER) {
            userConnections.stream()
                .min(Comparator.comparing(Connection::connectedAt))
                .filter(oldest -> !oldest.id().equals(connectionId))
                .ifPresent(oldest -> {
                    remove(userId, oldest.id());
                    oldest.emitter().complete();
                });
        }
        connectionsPerUser.record(userConnections.size());
        try {
            emitter.send(connectedEvent);
        } catch (IOException | IllegalStateException exception) {
            failedSends.increment();
            remove(userId, connectionId);
            emitter.completeWithError(exception);
        }
        return emitter;
    }

    public int sendToUser(Long userId, SseEmitter.SseEventBuilder event) {
        List<Connection> userConnections = connections.get(userId);
        if (userConnections == null) {
            return 0;
        }
        int delivered = 0;
        for (Connection connection : userConnections) {
            try {
                connection.emitter().send(event);
                delivered++;
            } catch (IOException | IllegalStateException exception) {
                failedSends.increment();
                remove(userId, connection.id());
                connection.emitter().completeWithError(exception);
            }
        }
        return delivered;
    }

    public void heartbeat(SseEmitter.SseEventBuilder event) {
        connections.keySet().forEach(userId -> sendToUser(userId, event));
    }

    public void disconnectUser(Long userId) {
        List<Connection> removed = connections.remove(userId);
        if (removed == null) {
            return;
        }
        activeConnections.addAndGet(-removed.size());
        removed.forEach(connection -> connection.emitter().complete());
    }

    public int activeConnectionCount() {
        return activeConnections.get();
    }

    public int activeConnectionCount(Long userId) {
        List<Connection> userConnections = connections.get(userId);
        return userConnections == null ? 0 : userConnections.size();
    }

    private void remove(Long userId, String connectionId) {
        connections.computeIfPresent(userId, (ignored, userConnections) -> {
            boolean removed = userConnections.removeIf(connection -> connection.id().equals(connectionId));
            if (removed) {
                activeConnections.decrementAndGet();
            }
            return userConnections.isEmpty() ? null : userConnections;
        });
    }

    private record Connection(String id, SseEmitter emitter, Instant connectedAt) {
    }
}
