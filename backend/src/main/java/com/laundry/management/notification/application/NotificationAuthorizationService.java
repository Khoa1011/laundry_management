package com.laundry.management.notification.application;

import com.laundry.management.auth.security.CurrentUser;
import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.notification.domain.NotificationAudienceType;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class NotificationAuthorizationService {
    private static final Map<NotificationAudienceType, String> AUDIENCE_PERMISSIONS = Map.of(
        NotificationAudienceType.SPECIFIC_USERS, PermissionCodes.NOTIFICATION_SEND_SPECIFIC,
        NotificationAudienceType.SPECIFIC_EMPLOYEES, PermissionCodes.NOTIFICATION_SEND_EMPLOYEE,
        NotificationAudienceType.ALL_ACTIVE_USERS_IN_BRANCH,
        PermissionCodes.NOTIFICATION_BROADCAST_BRANCH_USERS,
        NotificationAudienceType.ALL_ACTIVE_EMPLOYEES_IN_BRANCH,
        PermissionCodes.NOTIFICATION_BROADCAST_BRANCH_EMPLOYEES,
        NotificationAudienceType.USERS_BY_POSITION_IN_BRANCH,
        PermissionCodes.NOTIFICATION_SEND_BY_POSITION,
        NotificationAudienceType.USERS_BY_PERMISSION_IN_BRANCH,
        PermissionCodes.NOTIFICATION_SEND_BY_PERMISSION
    );

    private final CurrentUserProvider currentUserProvider;

    public NotificationAuthorizationService(CurrentUserProvider currentUserProvider) {
        this.currentUserProvider = currentUserProvider;
    }

    public void requireCanCreate(CreateNotificationCommand command) {
        if (command.createdBySystem()) {
            return;
        }
        CurrentUser currentUser = currentUserProvider.getRequired();
        if (command.actorUserId() == null || !command.actorUserId().equals(currentUser.id())) {
            throw denied("The notification actor must be the authenticated user.");
        }
        String permission = AUDIENCE_PERMISSIONS.get(command.audienceType());
        if (permission == null || !currentUser.permissions().contains(permission)) {
            throw denied("You do not have permission to send to the selected audience.");
        }
        if (command.branchId() == null || !currentUser.canAccessBranch(command.branchId())) {
            throw denied("You cannot target notification recipients outside your branch scope.");
        }
    }

    private ApiException denied(String detail) {
        return new ApiException(
            HttpStatus.FORBIDDEN,
            ErrorCode.NOTIFICATION_SCOPE_DENIED,
            "Notification scope denied",
            detail
        );
    }
}
