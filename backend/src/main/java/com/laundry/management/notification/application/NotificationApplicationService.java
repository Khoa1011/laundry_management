package com.laundry.management.notification.application;

import com.laundry.management.notification.api.NotificationDtos;
import com.laundry.management.notification.domain.NotificationAudienceType;
import com.laundry.management.notification.infrastructure.NotificationRecipientRepository;
import com.laundry.management.notification.infrastructure.NotificationRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
public class NotificationApplicationService {
    private final NotificationRepository notificationRepository;
    private final NotificationRecipientRepository recipientRepository;
    private final NotificationAuthorizationService authorizationService;
    private final NotificationContentValidator contentValidator;
    private final NotificationTransactionalCreator transactionalCreator;

    public NotificationApplicationService(
        NotificationRepository notificationRepository,
        NotificationRecipientRepository recipientRepository,
        NotificationAuthorizationService authorizationService,
        NotificationContentValidator contentValidator,
        NotificationTransactionalCreator transactionalCreator
    ) {
        this.notificationRepository = notificationRepository;
        this.recipientRepository = recipientRepository;
        this.authorizationService = authorizationService;
        this.contentValidator = contentValidator;
        this.transactionalCreator = transactionalCreator;
    }

    public NotificationDtos.SendResponse notify(CreateNotificationCommand command) {
        authorizationService.requireCanCreate(command);
        String metadataJson = contentValidator.validateAndSerialize(command);
        if (command.deduplicationKey() != null) {
            var existing = notificationRepository.findByDeduplicationKey(command.deduplicationKey());
            if (existing.isPresent()) {
                return new NotificationDtos.SendResponse(
                    existing.get().getId(),
                    Math.toIntExact(recipientRepository.countByNotificationId(existing.get().getId())),
                    false
                );
            }
        }

        try {
            return transactionalCreator.create(command, metadataJson);
        } catch (DataIntegrityViolationException exception) {
            if (command.deduplicationKey() == null) {
                throw exception;
            }
            var existing = notificationRepository.findByDeduplicationKey(command.deduplicationKey());
            if (existing.isEmpty()) {
                throw exception;
            }
            return new NotificationDtos.SendResponse(
                existing.get().getId(),
                Math.toIntExact(recipientRepository.countByNotificationId(existing.get().getId())),
                false
            );
        }
    }

    public NotificationDtos.SendResponse notifySpecificUsers(CreateNotificationCommand command) {
        requireAudience(command, NotificationAudienceType.SPECIFIC_USERS);
        return notify(command);
    }

    public NotificationDtos.SendResponse notifySpecificEmployees(CreateNotificationCommand command) {
        requireAudience(command, NotificationAudienceType.SPECIFIC_EMPLOYEES);
        return notify(command);
    }

    public NotificationDtos.SendResponse notifyAllEmployeesInBranch(CreateNotificationCommand command) {
        requireAudience(command, NotificationAudienceType.ALL_ACTIVE_EMPLOYEES_IN_BRANCH);
        return notify(command);
    }

    public NotificationDtos.SendResponse notifyByPosition(CreateNotificationCommand command) {
        requireAudience(command, NotificationAudienceType.USERS_BY_POSITION_IN_BRANCH);
        return notify(command);
    }

    public NotificationDtos.SendResponse notifyByPermission(CreateNotificationCommand command) {
        requireAudience(command, NotificationAudienceType.USERS_BY_PERMISSION_IN_BRANCH);
        return notify(command);
    }

    private void requireAudience(CreateNotificationCommand command, NotificationAudienceType expected) {
        if (command.audienceType() != expected) {
            throw new IllegalArgumentException("Notification command audience does not match convenience method");
        }
    }
}
