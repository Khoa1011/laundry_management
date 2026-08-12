package com.laundry.management.customer.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.laundry.management.customer.domain.AddressStatus;
import com.laundry.management.location.domain.AdministrativeVersion;
import java.time.Instant;

public record CustomerAddressResponse(
    Long id,
    String receiverName,
    String receiverPhone,
    AdministrativeVersion administrativeVersion,
    String province,
    Integer provinceCode,
    String district,
    Integer districtCode,
    String ward,
    Integer wardCode,
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
