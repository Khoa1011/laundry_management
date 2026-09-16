package com.laundry.management.realtime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.notification.realtime.NotificationConnectionRegistry;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class RealtimeSseServiceTest {

    @Test
    void dispatchUsesExplicitTopicWithoutLeakingAcrossTopics() {
        NotificationConnectionRegistry registry = mock(NotificationConnectionRegistry.class);
        RealtimeSseService service = new RealtimeSseService(
            registry, mock(CurrentUserProvider.class), new RealtimeTopicResolver());
        RealtimeEnvelope envelope = new RealtimeEnvelope(
            "evt-1", "order.updated", 7L, 11L, "CN01-DH-000011", 2L, Instant.now());

        service.dispatch(RealtimeTopic.ORDER, List.of(19L), envelope);

        verify(registry).sendToUser(eq(19L), eq(RealtimeTopic.ORDER.value()), any());
        verify(registry, never()).sendToUser(eq(19L), eq(RealtimeTopic.NOTIFICATION.value()), any());
    }
}
