package com.laundry.management.operations.api;

import jakarta.validation.constraints.*;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.Instant;

public final class PolicyDtos {
    private PolicyDtos() {}
    public record Request(@NotNull @Positive Long branchId, @NotNull @Min(-1) Long version,
        @NotNull Boolean approvalRequired, @NotNull @DecimalMin("0") @Digits(integer=17, fraction=2) BigDecimal approvalThreshold,
        @NotNull Boolean allowNegative, @Positive Long defaultResourceId) {}
    public record Response(Long branchId, long version, boolean approvalRequired, @JsonFormat(shape=JsonFormat.Shape.STRING) BigDecimal approvalThreshold,
        boolean allowNegative, Long defaultResourceId, String valuationMethod, String currency, Instant updatedAt) {}
    public record Audit(Long id, String resource, Long recordId, String action, Long actorId, Instant occurredAt, String changedFields) {}
}
