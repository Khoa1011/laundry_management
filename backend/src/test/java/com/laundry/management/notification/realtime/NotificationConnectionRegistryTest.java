package com.laundry.management.notification.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import com.laundry.management.realtime.RealtimeTopic;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class NotificationConnectionRegistryTest {

    @Test
    void deliversOnlyToConnectionsSubscribedToTheRequestedTopic() {
        NotificationConnectionRegistry registry = new NotificationConnectionRegistry(new SimpleMeterRegistry());
        registry.register(19L, 60_000L, event("connected"), Set.of(RealtimeTopic.ORDER.value()));

        assertThat(registry.sendToUser(19L, RealtimeTopic.NOTIFICATION.value(), event("notification.created")))
            .isZero();
        assertThat(registry.sendToUser(19L, RealtimeTopic.ORDER.value(), event("order.updated")))
            .isOne();

        registry.disconnectUser(19L);
    }

    private SseEmitter.SseEventBuilder event(String name) {
        return SseEmitter.event().name(name).data(name);
    }
}
