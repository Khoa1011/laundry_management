package com.laundry.management.notification.application;

import com.laundry.management.notification.domain.NotificationAudienceType;
import com.laundry.management.notification.infrastructure.NotificationRecipientLookupRepository;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class ActiveUsersInBranchResolver implements NotificationAudienceResolver {
    private final NotificationRecipientLookupRepository lookupRepository;

    public ActiveUsersInBranchResolver(NotificationRecipientLookupRepository lookupRepository) {
        this.lookupRepository = lookupRepository;
    }

    @Override
    public NotificationAudienceType supports() {
        return NotificationAudienceType.ALL_ACTIVE_USERS_IN_BRANCH;
    }

    @Override
    public Set<Long> resolveCandidates(CreateNotificationCommand command) {
        return new LinkedHashSet<>(lookupRepository.findActiveUserIdsInBranch(command.branchId()));
    }
}
