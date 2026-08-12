package com.laundry.management.notification.api;

import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.notification.application.NotificationApplicationService;
import com.laundry.management.notification.application.NotificationPreferenceService;
import com.laundry.management.notification.application.NotificationQueryService;
import com.laundry.management.notification.domain.NotificationReferenceType;
import com.laundry.management.notification.domain.NotificationSeverity;
import com.laundry.management.notification.domain.NotificationType;
import com.laundry.management.notification.realtime.NotificationSseService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationQueryService queryService;
    private final NotificationPreferenceService preferenceService;
    private final NotificationApplicationService applicationService;
    private final NotificationSseService sseService;
    private final CurrentUserProvider currentUserProvider;

    public NotificationController(
        NotificationQueryService queryService,
        NotificationPreferenceService preferenceService,
        NotificationApplicationService applicationService,
        NotificationSseService sseService,
        CurrentUserProvider currentUserProvider
    ) {
        this.queryService = queryService;
        this.preferenceService = preferenceService;
        this.applicationService = applicationService;
        this.sseService = sseService;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping
    public NotificationDtos.PageResponse list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "ALL") NotificationDtos.ListStatus status,
        @RequestParam(required = false) NotificationType type,
        @RequestParam(required = false) NotificationSeverity severity,
        @RequestParam(required = false) Long branchId,
        @RequestParam(required = false) NotificationReferenceType referenceType
    ) {
        return queryService.list(page, size, status, type, severity, branchId, referenceType);
    }

    @GetMapping("/{notificationId}")
    public NotificationDtos.ItemResponse detail(@PathVariable Long notificationId) {
        return queryService.detail(notificationId);
    }

    @GetMapping("/unread-count")
    public NotificationDtos.UnreadCountResponse unreadCount() {
        return queryService.unreadCount();
    }

    @PatchMapping("/{notificationId}/read")
    public NotificationDtos.MutationResponse markRead(@PathVariable Long notificationId) {
        return queryService.markRead(notificationId);
    }

    @PatchMapping("/read-all")
    public NotificationDtos.MutationResponse markAllRead() {
        return queryService.markAllRead();
    }

    @PatchMapping("/{notificationId}/dismiss")
    public NotificationDtos.MutationResponse dismiss(@PathVariable Long notificationId) {
        return queryService.dismiss(notificationId);
    }

    @GetMapping("/preferences")
    public NotificationDtos.PreferenceResponse preferences() {
        return preferenceService.get();
    }

    @PutMapping("/preferences")
    public NotificationDtos.PreferenceResponse updatePreferences(
        @Valid @RequestBody NotificationDtos.PreferenceUpdateRequest request
    ) {
        return preferenceService.update(request);
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return sseService.connect();
    }

    @PostMapping
    @PreAuthorize("""
        @permissionChecker.hasAny(authentication,
          T(com.laundry.management.auth.security.permission.PermissionCodes).NOTIFICATION_SEND_SPECIFIC,
          T(com.laundry.management.auth.security.permission.PermissionCodes).NOTIFICATION_SEND_EMPLOYEE,
          T(com.laundry.management.auth.security.permission.PermissionCodes).NOTIFICATION_BROADCAST_BRANCH_USERS,
          T(com.laundry.management.auth.security.permission.PermissionCodes).NOTIFICATION_BROADCAST_BRANCH_EMPLOYEES,
          T(com.laundry.management.auth.security.permission.PermissionCodes).NOTIFICATION_SEND_BY_POSITION,
          T(com.laundry.management.auth.security.permission.PermissionCodes).NOTIFICATION_SEND_BY_PERMISSION)
        """)
    public NotificationDtos.SendResponse send(@Valid @RequestBody NotificationDtos.SendRequest request) {
        return applicationService.notify(request.toCommand(currentUserProvider.getRequired().id()));
    }
}
