package com.laundry.management.notification.application;

import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.notification.api.NotificationDtos;
import com.laundry.management.notification.domain.NotificationReferenceType;
import com.laundry.management.notification.domain.NotificationSeverity;
import com.laundry.management.notification.domain.NotificationType;
import com.laundry.management.notification.infrastructure.NotificationRecipientRepository;
import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationQueryService {
    private static final int MAX_PAGE_SIZE = 50;
    private final NotificationRecipientRepository recipientRepository;
    private final CurrentUserProvider currentUserProvider;
    private final NotificationMapper mapper;
    private final NotificationEventPublisher eventPublisher;

    public NotificationQueryService(
        NotificationRecipientRepository recipientRepository,
        CurrentUserProvider currentUserProvider,
        NotificationMapper mapper,
        NotificationEventPublisher eventPublisher
    ) {
        this.recipientRepository = recipientRepository;
        this.currentUserProvider = currentUserProvider;
        this.mapper = mapper;
        this.eventPublisher = eventPublisher;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).NOTIFICATION_READ_OWN)")
    @Transactional(readOnly = true)
    public NotificationDtos.PageResponse list(
        int page,
        int size,
        NotificationDtos.ListStatus status,
        NotificationType type,
        NotificationSeverity severity,
        Long branchId,
        NotificationReferenceType referenceType
    ) {
        validatePage(page, size);
        Long userId = currentUserProvider.getRequired().id();
        Instant now = Instant.now();
        Page<com.laundry.management.notification.domain.NotificationRecipient> result =
            recipientRepository.findVisible(
                userId,
                (status == null ? NotificationDtos.ListStatus.ALL : status).name(),
                type,
                severity,
                branchId,
                referenceType,
                now,
                PageRequest.of(page, size)
            );
        return new NotificationDtos.PageResponse(
            result.getContent().stream().map(mapper::toItem).toList(),
            page,
            size,
            result.getTotalElements(),
            result.getTotalPages(),
            result.hasNext(),
            recipientRepository.countUnread(userId, now)
        );
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).NOTIFICATION_READ_OWN)")
    @Transactional(readOnly = true)
    public NotificationDtos.ItemResponse detail(Long notificationId) {
        return mapper.toItem(requireVisible(currentUserProvider.getRequired().id(), notificationId, Instant.now()));
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).NOTIFICATION_READ_OWN)")
    @Transactional(readOnly = true)
    public NotificationDtos.UnreadCountResponse unreadCount() {
        return new NotificationDtos.UnreadCountResponse(
            recipientRepository.countUnread(currentUserProvider.getRequired().id(), Instant.now())
        );
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).NOTIFICATION_MARK_READ_OWN)")
    @Transactional
    public NotificationDtos.MutationResponse markRead(Long notificationId) {
        Long userId = currentUserProvider.getRequired().id();
        requireOwned(userId, notificationId);
        Instant now = Instant.now();
        int updated = recipientRepository.markRead(userId, notificationId, now);
        long unread = recipientRepository.countUnread(userId, now);
        eventPublisher.stateChanged(new NotificationStateChangedEvent(
            userId, "notification.read", notificationId, unread
        ));
        return new NotificationDtos.MutationResponse(notificationId, updated, unread);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).NOTIFICATION_MARK_ALL_READ_OWN)")
    @Transactional
    public NotificationDtos.MutationResponse markAllRead() {
        Long userId = currentUserProvider.getRequired().id();
        Instant now = Instant.now();
        int updated = recipientRepository.markAllRead(userId, now);
        long unread = recipientRepository.countUnread(userId, now);
        eventPublisher.stateChanged(new NotificationStateChangedEvent(
            userId, "notification.read", null, unread
        ));
        return new NotificationDtos.MutationResponse(null, updated, unread);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).NOTIFICATION_DISMISS_OWN)")
    @Transactional
    public NotificationDtos.MutationResponse dismiss(Long notificationId) {
        Long userId = currentUserProvider.getRequired().id();
        requireOwned(userId, notificationId);
        Instant now = Instant.now();
        int updated = recipientRepository.dismiss(userId, notificationId, now);
        long unread = recipientRepository.countUnread(userId, now);
        eventPublisher.stateChanged(new NotificationStateChangedEvent(
            userId, "notification.dismissed", notificationId, unread
        ));
        return new NotificationDtos.MutationResponse(notificationId, updated, unread);
    }

    private void requireOwned(Long userId, Long notificationId) {
        if (notificationId == null || !recipientRepository.existsByUserIdAndNotificationId(userId, notificationId)) {
            throw notFound();
        }
    }

    private com.laundry.management.notification.domain.NotificationRecipient requireVisible(
        Long userId,
        Long notificationId,
        Instant now
    ) {
        return recipientRepository.findVisibleDetail(userId, notificationId, now).orElseThrow(this::notFound);
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                ErrorCode.PAGE_SIZE_EXCEEDED,
                "Invalid notification page",
                "Page must be non-negative and size must be between 1 and 50."
            );
        }
    }

    private ApiException notFound() {
        return new ApiException(
            HttpStatus.NOT_FOUND,
            ErrorCode.NOTIFICATION_NOT_FOUND,
            "Notification not found",
            "The notification does not exist or does not belong to the current user."
        );
    }
}
