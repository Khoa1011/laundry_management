package com.laundry.management.notification.application;

import com.laundry.management.notification.domain.NotificationAudienceType;
import java.util.Set;

public interface NotificationAudienceResolver {
    NotificationAudienceType supports();
    Set<Long> resolveCandidates(CreateNotificationCommand command);
}
