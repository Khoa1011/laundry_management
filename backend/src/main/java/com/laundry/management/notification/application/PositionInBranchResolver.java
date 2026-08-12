package com.laundry.management.notification.application;

import com.laundry.management.notification.domain.NotificationAudienceType;
import com.laundry.management.notification.infrastructure.NotificationRecipientLookupRepository;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class PositionInBranchResolver implements NotificationAudienceResolver {
    private final NotificationRecipientLookupRepository lookupRepository;

    public PositionInBranchResolver(NotificationRecipientLookupRepository lookupRepository) {
        this.lookupRepository = lookupRepository;
    }

    @Override
    public NotificationAudienceType supports() {
        return NotificationAudienceType.USERS_BY_POSITION_IN_BRANCH;
    }

    @Override
    public Set<Long> resolveCandidates(CreateNotificationCommand command) {
        if (command.targetPositionIds().isEmpty()) {
            return Set.of();
        }
        return new LinkedHashSet<>(lookupRepository.findActiveUserIdsByPosition(
            command.branchId(), command.targetPositionIds()
        ));
    }
}
