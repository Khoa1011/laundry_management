package com.laundry.management.customer.api;

import com.laundry.management.customer.domain.CustomerStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CustomerStatusRequest(
    @NotNull(message = "Status is required")
    CustomerStatus status,

    @NotNull(message = "Version is required")
    @Min(value = 0, message = "Version must not be negative")
    Long version
) {
}
