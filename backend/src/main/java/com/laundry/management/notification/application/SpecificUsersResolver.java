package com.laundry.management.notification.application;

import com.laundry.management.notification.domain.NotificationAudienceType;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class SpecificUsersResolver implements NotificationAudienceResolver {
    @Override
    public NotificationAudienceType supports() {
        return NotificationAudienceType.SPECIFIC_USERS;
    }

    @Override
    public Set<Long> resolveCandidates(CreateNotificationCommand command) {
        return command.targetUserIds();
    }
}
