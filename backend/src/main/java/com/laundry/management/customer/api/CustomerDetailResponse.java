package com.laundry.management.customer.api;

import com.laundry.management.customer.domain.CustomerSource;
import com.laundry.management.customer.domain.CustomerStatus;
import com.laundry.management.customer.domain.CustomerType;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record CustomerDetailResponse(
    Long id,
    String customerCode,
    String fullName,
    String phone,
    String email,
    LocalDate birthDate,
    CustomerType customerType,
    CustomerSource source,
    String note,
    CustomerStatus status,
    BranchResponse branch,
    List<CustomerAddressResponse> addresses,
    long version,
    Instant createdAt,
    Instant updatedAt
) {

    public record BranchResponse(Long id, String code, String name) {
    }
}
