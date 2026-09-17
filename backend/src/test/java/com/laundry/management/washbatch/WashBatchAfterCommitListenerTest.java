package com.laundry.management.washbatch;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.notification.infrastructure.NotificationRecipientLookupRepository;
import com.laundry.management.realtime.*;
import com.laundry.management.washbatch.application.*;
import java.lang.reflect.Method;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.event.*;

@ExtendWith(MockitoExtension.class)
class WashBatchAfterCommitListenerTest {
    @Mock NotificationRecipientLookupRepository recipients;
    @Mock RealtimeSseService realtime;
    @InjectMocks WashBatchAfterCommitListener listener;

    @Test
    void dispatchesOnlyToSameBranchUsersWithEffectiveBatchReadAfterCommit() throws Exception {
        Instant occurredAt = Instant.parse("2026-09-17T10:00:00Z");
        WashBatchChangedEvent event = new WashBatchChangedEvent(9L, "CN01-MG-000009", 4L, 3L, "batch.ready", occurredAt);
        RealtimeEnvelope envelope = new RealtimeEnvelope("event-1", "batch.ready", 4L, 9L, "CN01-MG-000009", 3L, occurredAt);
        when(recipients.findActiveUserIdsByEffectivePermission(4L, PermissionCodes.BATCH_READ)).thenReturn(List.of(11L, 12L));
        when(realtime.envelope("batch.ready", 4L, 9L, "CN01-MG-000009", 3L, occurredAt)).thenReturn(envelope);

        listener.onChanged(event);

        verify(recipients).findActiveUserIdsByEffectivePermission(4L, PermissionCodes.BATCH_READ);
        verify(realtime).dispatch(RealtimeTopic.BATCH, List.of(11L, 12L), envelope);
        verifyNoMoreInteractions(recipients, realtime);
        Method method = WashBatchAfterCommitListener.class.getMethod("onChanged", WashBatchChangedEvent.class);
        TransactionalEventListener annotation = method.getAnnotation(TransactionalEventListener.class);
        org.junit.jupiter.api.Assertions.assertEquals(TransactionPhase.AFTER_COMMIT, annotation.phase());
    }
}
