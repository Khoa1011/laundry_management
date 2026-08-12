package com.laundry.management.notification.application;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.notification.domain.NotificationAudienceType;
import com.laundry.management.notification.infrastructure.NotificationRecipientLookupRepository;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class NotificationRecipientResolver {
    private final Map<NotificationAudienceType, NotificationAudienceResolver> resolvers;
    private final NotificationRecipientLookupRepository lookupRepository;

    public NotificationRecipientResolver(
        List<NotificationAudienceResolver> resolvers,
        NotificationRecipientLookupRepository lookupRepository
    ) {
        Map<NotificationAudienceType, NotificationAudienceResolver> byType =
            new EnumMap<>(NotificationAudienceType.class);
        resolvers.forEach(resolver -> byType.put(resolver.supports(), resolver));
        this.resolvers = Map.copyOf(byType);
        this.lookupRepository = lookupRepository;
    }

    public Set<Long> resolve(CreateNotificationCommand command) {
        validateAudienceInput(command);
        NotificationAudienceResolver resolver = resolvers.get(command.audienceType());
        if (resolver == null) {
            throw invalidTarget("The selected notification audience is not supported.");
        }
        Set<Long> candidates = new LinkedHashSet<>(resolver.resolveCandidates(command));
        if (candidates.isEmpty()) {
            return Set.of();
        }
        Set<Long> eligible = new LinkedHashSet<>(
            lookupRepository.findEligibleUserIds(candidates, command.branchId())
        );
        if (!command.createdBySystem()
            && command.audienceType() == NotificationAudienceType.SPECIFIC_USERS
            && eligible.size() != candidates.size()) {
            throw invalidTarget("One or more selected users are inactive, locked, missing, or outside branch scope.");
        }
        if (command.excludeActor() && command.actorUserId() != null) {
            eligible.remove(command.actorUserId());
        }
        return Set.copyOf(eligible);
    }

    private void validateAudienceInput(CreateNotificationCommand command) {
        if (command.audienceType() == null) {
            throw invalidTarget("Select a notification audience.");
        }
        boolean branchRequired = command.audienceType() != NotificationAudienceType.SPECIFIC_USERS;
        if (branchRequired && command.branchId() == null) {
            throw invalidTarget("A branch is required for the selected audience.");
        }
        switch (command.audienceType()) {
            case SPECIFIC_USERS -> requireTargets(command.targetUserIds(), "Select at least one user.");
            case SPECIFIC_EMPLOYEES ->
                requireTargets(command.targetEmployeeIds(), "Select at least one employee.");
            case USERS_BY_POSITION_IN_BRANCH -> {
                requireTargets(command.targetPositionIds(), "Select at least one employee position.");
                if (lookupRepository.countActivePositions(command.targetPositionIds())
                    != command.targetPositionIds().size()) {
                    throw invalidTarget("One or more selected employee positions are missing or inactive.");
                }
            }
            case USERS_BY_PERMISSION_IN_BRANCH -> {
                if (command.targetPermissionCode() == null || command.targetPermissionCode().isBlank()) {
                    throw invalidTarget("Select a permission code.");
                }
                if (lookupRepository.countActivePermission(command.targetPermissionCode()) != 1) {
                    throw invalidTarget("The selected permission does not exist or is inactive.");
                }
            }
            default -> {
            }
        }
    }

    private void requireTargets(Set<Long> targets, String detail) {
        if (targets == null || targets.isEmpty() || targets.stream().anyMatch(id -> id == null || id <= 0)) {
            throw invalidTarget(detail);
        }
    }

    private ApiException invalidTarget(String detail) {
        return new ApiException(
            HttpStatus.BAD_REQUEST,
            ErrorCode.NOTIFICATION_TARGET_INVALID,
            "Invalid notification audience",
            detail
        );
    }
}
