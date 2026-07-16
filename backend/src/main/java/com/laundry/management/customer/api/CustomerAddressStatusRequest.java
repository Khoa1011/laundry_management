package com.laundry.management.customer.api;

import com.laundry.management.customer.domain.AddressStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CustomerAddressStatusRequest(
    @NotNull(message = "Status is required")
    AddressStatus status,

    @NotNull(message = "Version is required")
    @Min(value = 0, message = "Version must not be negative")
    Long version,

    Long replacementAddressId
) {
}
