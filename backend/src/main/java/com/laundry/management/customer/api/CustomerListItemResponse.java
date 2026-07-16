package com.laundry.management.customer.api;

import com.laundry.management.customer.domain.CustomerSource;
import com.laundry.management.customer.domain.CustomerStatus;
import com.laundry.management.customer.domain.CustomerType;
import java.time.Instant;

public record CustomerListItemResponse(
    Long id,
    String customerCode,
    String fullName,
    String phone,
    String email,
    CustomerType customerType,
    CustomerSource source,
    CustomerStatus status,
    Instant createdAt,
    Instant updatedAt
) {
}
