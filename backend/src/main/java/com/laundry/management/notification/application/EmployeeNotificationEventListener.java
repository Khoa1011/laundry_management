package com.laundry.management.notification.application;

import com.laundry.management.employee.application.EmployeeAccountLinkedEvent;
import com.laundry.management.employee.application.EmployeeBranchChangedEvent;
import com.laundry.management.employee.application.EmployeeStatusChangedEvent;
import com.laundry.management.notification.domain.NotificationAudienceType;
import com.laundry.management.notification.domain.NotificationReferenceType;
import com.laundry.management.notification.domain.NotificationSeverity;
import com.laundry.management.notification.domain.NotificationType;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class EmployeeNotificationEventListener {
    private static final Logger LOGGER = LoggerFactory.getLogger(EmployeeNotificationEventListener.class);
    private final NotificationApplicationService notificationService;

    public EmployeeNotificationEventListener(NotificationApplicationService notificationService) {
        this.notificationService = notificationService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onBranchChanged(EmployeeBranchChangedEvent event) {
        safely("employee branch change", event.employeeId(), () -> notificationService.notifySpecificEmployees(
            baseEmployeeCommand(event.employeeId(), event.employeeName(), event.branchId(), event.actorUserId())
                .type(NotificationType.EMPLOYEE_BRANCH_CHANGED)
                .severity(NotificationSeverity.INFO)
                .titleKey("notification.employeeBranchChanged.title")
                .messageKey("notification.employeeBranchChanged.message")
                .titleFallback("Chi nhánh làm việc đã thay đổi")
                .messageFallback("Phân công chi nhánh làm việc của bạn vừa được cập nhật.")
                .metadata(Map.of(
                    "employeeName", event.employeeName(),
                    "branchName", event.branchName(),
                    "changeType", event.changeType()
                ))
                .deduplicationKey(
                    "EMPLOYEE_BRANCH_CHANGED:" + event.employeeId() + ":" + event.employeeVersion()
                        + ":BRANCH:" + event.branchId() + ":" + event.changeType()
                )
                .build()
        ));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onStatusChanged(EmployeeStatusChangedEvent event) {
        safely("employee status change", event.employeeId(), () -> notificationService.notifySpecificEmployees(
            baseEmployeeCommand(event.employeeId(), event.employeeName(), event.branchId(), event.actorUserId())
                .type(NotificationType.EMPLOYEE_STATUS_CHANGED)
                .severity(event.newStatus().name().equals("ACTIVE")
                    ? NotificationSeverity.SUCCESS
                    : NotificationSeverity.WARNING)
                .titleKey("notification.employeeStatusChanged.title")
                .messageKey("notification.employeeStatusChanged.message")
                .titleFallback("Trạng thái làm việc đã thay đổi")
                .messageFallback("Trạng thái làm việc của bạn vừa được cập nhật.")
                .metadata(Map.of(
                    "employeeName", event.employeeName(),
                    "oldStatus", event.oldStatus().name(),
                    "newStatus", event.newStatus().name()
                ))
                .deduplicationKey(
                    "EMPLOYEE_STATUS_CHANGED:" + event.employeeId() + ":" + event.employeeVersion()
                )
                .build()
        ));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onAccountLinked(EmployeeAccountLinkedEvent event) {
        safely("employee account link", event.employeeId(), () -> notificationService.notify(
            CreateNotificationCommand.builder()
                .type(NotificationType.EMPLOYEE_ACCOUNT_LINKED)
                .severity(NotificationSeverity.SUCCESS)
                .titleKey("notification.employeeAccountLinked.title")
                .messageKey("notification.employeeAccountLinked.message")
                .titleFallback("Tài khoản đã được liên kết")
                .messageFallback("Tài khoản của bạn vừa được liên kết với hồ sơ nhân viên.")
                .metadata(Map.of("employeeName", event.employeeName()))
                .audienceType(NotificationAudienceType.SPECIFIC_USERS)
                .targetUserIds(Set.of(event.linkedUserId()))
                .branchId(event.branchId())
                .actorUserId(event.actorUserId())
                .excludeActor(true)
                .referenceType(NotificationReferenceType.EMPLOYEE)
                .referenceId(event.employeeId().toString())
                .deepLink("/employees/" + event.employeeId())
                .deduplicationKey(
                    "EMPLOYEE_ACCOUNT_LINKED:" + event.employeeId() + ":" + event.employeeVersion()
                        + ":USER:" + event.linkedUserId()
                )
                .createdBySystem(true)
                .build()
        ));
    }

    private CreateNotificationCommand.Builder baseEmployeeCommand(
        Long employeeId,
        String employeeName,
        Long branchId,
        Long actorUserId
    ) {
        return CreateNotificationCommand.builder()
            .audienceType(NotificationAudienceType.SPECIFIC_EMPLOYEES)
            .targetEmployeeIds(Set.of(employeeId))
            .branchId(branchId)
            .actorUserId(actorUserId)
            .excludeActor(true)
            .referenceType(NotificationReferenceType.EMPLOYEE)
            .referenceId(employeeId.toString())
            .deepLink("/employees/" + employeeId)
            .createdBySystem(true);
    }

    private void safely(String eventName, Long employeeId, Runnable action) {
        try {
            action.run();
        } catch (RuntimeException exception) {
            LOGGER.warn("Employee {} committed but {} notification failed", employeeId, eventName);
        }
    }
}
