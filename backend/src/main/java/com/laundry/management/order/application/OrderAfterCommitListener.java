package com.laundry.management.order.application;

import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.notification.application.*;
import com.laundry.management.notification.domain.*;
import com.laundry.management.notification.infrastructure.NotificationRecipientLookupRepository;
import com.laundry.management.order.domain.OrderStatus;
import com.laundry.management.realtime.RealtimeSseService;
import com.laundry.management.realtime.RealtimeTopic;
import java.util.*;
import org.slf4j.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.*;

@Component
public class OrderAfterCommitListener {
    private static final Logger LOGGER=LoggerFactory.getLogger(OrderAfterCommitListener.class);
    private final NotificationRecipientLookupRepository recipients; private final RealtimeSseService realtime; private final NotificationApplicationService notifications;
    public OrderAfterCommitListener(NotificationRecipientLookupRepository recipients,RealtimeSseService realtime,NotificationApplicationService notifications){this.recipients=recipients;this.realtime=realtime;this.notifications=notifications;}
    @TransactionalEventListener(phase=TransactionPhase.AFTER_COMMIT)
    public void onChanged(OrderChangedEvent event){
        try{
            List<Long> users=recipients.findActiveUserIdsByEffectivePermission(event.branchId(),PermissionCodes.ORDER_READ);
            realtime.dispatch(RealtimeTopic.ORDER,users,realtime.envelope(event.eventType(),event.branchId(),event.orderId(),event.orderCode(),event.version(),event.occurredAt()));
            if(Set.of(OrderStatus.READY,OrderStatus.CANCELLED,OrderStatus.REOPENED).contains(event.status())) notifyImportant(event);
        }catch(RuntimeException ex){LOGGER.warn("Order {} committed but secondary realtime/notification dispatch failed",event.orderId(),ex);}
    }
    private void notifyImportant(OrderChangedEvent event){
        NotificationType type=switch(event.status()){case READY->NotificationType.ORDER_READY;case CANCELLED->NotificationType.ORDER_CANCELLED;case REOPENED->NotificationType.ORDER_REOPENED;default->throw new IllegalStateException();};
        NotificationSeverity severity=switch(event.status()){case READY->NotificationSeverity.SUCCESS;case CANCELLED->NotificationSeverity.ERROR;case REOPENED->NotificationSeverity.WARNING;default->NotificationSeverity.INFO;};
        String title=switch(event.status()){case READY->"Đơn hàng đã sẵn sàng";case CANCELLED->"Đơn hàng đã bị hủy";case REOPENED->"Đơn hàng đã được mở lại";default->"Đơn hàng cập nhật";};
        notifications.notifyByPermission(CreateNotificationCommand.builder().type(type).severity(severity)
            .titleKey("orders.notification."+event.status().name().toLowerCase()+".title")
            .messageKey("orders.notification."+event.status().name().toLowerCase()+".message")
            .titleFallback(title).messageFallback(event.orderCode()+" · "+title)
            .metadata(Map.of("orderId",event.orderId(),"orderCode",event.orderCode(),"status",event.status().name()))
            .audienceType(NotificationAudienceType.USERS_BY_PERMISSION_IN_BRANCH).targetPermissionCode(PermissionCodes.ORDER_READ)
            .branchId(event.branchId()).excludeActor(false).referenceType(NotificationReferenceType.ORDER)
            .referenceId(event.orderId().toString()).deepLink("/orders/"+event.orderId())
            .deduplicationKey("order:"+event.orderId()+":"+event.status()+":"+event.version()).createdBySystem(true).build());
    }
}
