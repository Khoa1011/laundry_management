package com.laundry.management.notification.application;

import com.laundry.management.notification.api.NotificationDtos;
import com.laundry.management.notification.domain.Notification;
import com.laundry.management.notification.infrastructure.NotificationRecipientBatchWriter;
import com.laundry.management.notification.infrastructure.NotificationRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationTransactionalCreator {
    private final NotificationRepository notificationRepository;
    private final NotificationRecipientBatchWriter recipientBatchWriter;
    private final NotificationRecipientResolver recipientResolver;
    private final NotificationMapper mapper;
    private final NotificationEventPublisher eventPublisher;
    private final Counter createdNotifications;
    private final Counter createdRecipients;

    public NotificationTransactionalCreator(
        NotificationRepository notificationRepository,
        NotificationRecipientBatchWriter recipientBatchWriter,
        NotificationRecipientResolver recipientResolver,
        NotificationMapper mapper,
        NotificationEventPublisher eventPublisher,
        MeterRegistry meterRegistry
    ) {
        this.notificationRepository = notificationRepository;
        this.recipientBatchWriter = recipientBatchWriter;
        this.recipientResolver = recipientResolver;
        this.mapper = mapper;
        this.eventPublisher = eventPublisher;
        this.createdNotifications = Counter.builder("notification.created")
            .description("Committed internal notifications")
            .register(meterRegistry);
        this.createdRecipients = Counter.builder("notification.recipients.created")
            .description("Materialized internal notification recipients")
            .register(meterRegistry);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public NotificationDtos.SendResponse create(CreateNotificationCommand command, String metadataJson) {
        Set<Long> recipientUserIds = recipientResolver.resolve(command);
        Notification notification = notificationRepository.save(new Notification(
            command.type(),
            command.severity(),
            command.titleKey(),
            command.messageKey(),
            command.titleFallback(),
            command.messageFallback(),
            metadataJson,
            command.branchId(),
            command.actorUserId(),
            command.audienceType(),
            command.referenceType(),
            command.referenceId(),
            command.deepLink(),
            command.excludeActor(),
            command.deduplicationKey(),
            command.createdBySystem(),
            command.expiresAt()
        ));
        notificationRepository.flush();
        recipientBatchWriter.insert(notification.getId(), recipientUserIds);
        createdNotifications.increment();
        createdRecipients.increment(recipientUserIds.size());
        if (!recipientUserIds.isEmpty()) {
            eventPublisher.notificationCreated(new NotificationCreatedEvent(
                notification.getId(),
                recipientUserIds,
                mapper.toNewItem(notification)
            ));
        }
        return new NotificationDtos.SendResponse(notification.getId(), recipientUserIds.size(), true);
    }
}
