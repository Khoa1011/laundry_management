package com.laundry.management.sorting.application;

import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.notification.infrastructure.NotificationRecipientLookupRepository;
import com.laundry.management.realtime.*;
import org.slf4j.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.*;

@Component
public class SortingAfterCommitListener {
    private static final Logger LOGGER = LoggerFactory.getLogger(SortingAfterCommitListener.class);
    private final NotificationRecipientLookupRepository recipients;
    private final RealtimeSseService realtime;
    public SortingAfterCommitListener(NotificationRecipientLookupRepository recipients, RealtimeSseService realtime) {
        this.recipients = recipients; this.realtime = realtime;
    }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onChanged(SortingChangedEvent event) {
        try {
            var users = recipients.findActiveUserIdsByEffectivePermission(event.branchId(), PermissionCodes.SORTING_READ);
            realtime.dispatch(RealtimeTopic.SORTING, users, realtime.envelope(event.eventType(),
                event.branchId(), event.bagId(), event.bagCode(), event.version(), event.occurredAt()));
        } catch (RuntimeException ex) {
            LOGGER.warn("Sorting bag {} committed but realtime dispatch failed", event.bagId(), ex);
        }
    }
}
