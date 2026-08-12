package com.laundry.management.notification.realtime;

import com.laundry.management.employee.application.EmployeeLinkedAccountLockedEvent;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class EmployeeSseSecurityListener {
    private final NotificationSseService sseService;

    public EmployeeSseSecurityListener(NotificationSseService sseService) {
        this.sseService = sseService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onLinkedAccountLocked(EmployeeLinkedAccountLockedEvent event) {
        sseService.disconnectUser(event.userId());
    }
}
