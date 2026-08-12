package com.laundry.management.notification.application;

import com.laundry.management.notification.domain.NotificationAudienceType;
import com.laundry.management.notification.infrastructure.NotificationRecipientLookupRepository;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class SpecificEmployeesResolver implements NotificationAudienceResolver {
    private final NotificationRecipientLookupRepository lookupRepository;

    public SpecificEmployeesResolver(NotificationRecipientLookupRepository lookupRepository) {
        this.lookupRepository = lookupRepository;
    }

    @Override
    public NotificationAudienceType supports() {
        return NotificationAudienceType.SPECIFIC_EMPLOYEES;
    }

    @Override
    public Set<Long> resolveCandidates(CreateNotificationCommand command) {
        if (command.targetEmployeeIds().isEmpty()) {
            return Set.of();
        }
        return new LinkedHashSet<>(lookupRepository.findActiveEmployeeUserIds(
            command.targetEmployeeIds(), command.branchId()
        ));
    }
}
