package com.laundry.management.customer.api;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CustomerAddressVersionRequest(
    @NotNull(message = "Version is required")
    @Min(value = 0, message = "Version must not be negative")
    Long version
) {
}
