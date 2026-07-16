package com.laundry.management.customer.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.laundry.management.customer.domain.AddressStatus;
import java.time.Instant;

public record CustomerAddressResponse(
    Long id,
    String receiverName,
    String receiverPhone,
    String province,
    String district,
    String ward,
    String addressLine,
    String deliveryNote,
    @JsonProperty("isDefault")
    boolean defaultAddress,
    AddressStatus status,
    long version,
    Instant createdAt,
    Instant updatedAt
) {
}
