package com.laundry.management.customer.api;

import com.laundry.management.customer.domain.CustomerActivityAction;
import java.time.Instant;
import java.util.Map;

public record CustomerActivityResponse(
    Long id,
    String entityType,
    Long entityId,
    CustomerActivityAction action,
    Map<String, Object> changedFields,
    ActorResponse actor,
    Instant createdAt
) {

    public record ActorResponse(Long id, String displayName) {
    }
}
