package com.laundry.management.operations.api;

import jakarta.validation.constraints.*;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Instant;

public final class PolicyDtos {
    private PolicyDtos() {}
    // Old clients may send these fields during rollout. They have no effect and are never returned.
    @JsonIgnoreProperties({"approvalRequired", "approvalThreshold"})
    public record Request(@NotNull @Positive Long branchId, @NotNull @Min(-1) Long version,
        @NotNull Boolean allowNegative, @Positive Long defaultResourceId) {}
    public record Response(Long branchId, long version, boolean allowNegative, Long defaultResourceId,
        String valuationMethod, String currency, Instant updatedAt) {}
    public record Audit(Long id, String resource, Long recordId, String action, Long actorId, Instant occurredAt, String changedFields) {}
}
