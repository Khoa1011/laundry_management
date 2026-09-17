package com.laundry.management.washbatch.application;

import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.notification.infrastructure.NotificationRecipientLookupRepository;
import com.laundry.management.realtime.*;
import java.util.List;
import org.slf4j.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.*;

@Component
public class WashBatchAfterCommitListener {
    private static final Logger LOGGER=LoggerFactory.getLogger(WashBatchAfterCommitListener.class);
    private final NotificationRecipientLookupRepository recipients; private final RealtimeSseService realtime;
    public WashBatchAfterCommitListener(NotificationRecipientLookupRepository recipients,RealtimeSseService realtime){this.recipients=recipients;this.realtime=realtime;}
    @TransactionalEventListener(phase=TransactionPhase.AFTER_COMMIT)
    public void onChanged(WashBatchChangedEvent event){try{List<Long> users=recipients.findActiveUserIdsByEffectivePermission(event.branchId(),PermissionCodes.BATCH_READ);
        realtime.dispatch(RealtimeTopic.BATCH,users,realtime.envelope(event.eventType(),event.branchId(),event.batchId(),event.batchCode(),event.version(),event.occurredAt()));
    }catch(RuntimeException ex){LOGGER.warn("Wash batch {} committed but realtime dispatch failed",event.batchId(),ex);}}
}
