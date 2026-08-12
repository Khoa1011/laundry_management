package com.laundry.management.customer.api;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.laundry.management.location.domain.AdministrativeVersion;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record CustomerAddressUpdateRequest(
    @NotBlank(message = "Receiver name is required")
    @Size(max = 150, message = "Receiver name must not exceed 150 characters")
    String receiverName,

    @NotBlank(message = "Receiver phone is required")
    @Size(max = 30, message = "Receiver phone must not exceed 30 characters")
    String receiverPhone,

    AdministrativeVersion administrativeVersion,

    @Size(max = 120, message = "Province must not exceed 120 characters")
    String province,

    @Positive(message = "Province code must be positive")
    Integer provinceCode,

    @Size(max = 120, message = "District must not exceed 120 characters")
    String district,

    @Positive(message = "District code must be positive")
    Integer districtCode,

    @Size(max = 120, message = "Ward must not exceed 120 characters")
    String ward,

    @Positive(message = "Ward code must be positive")
    Integer wardCode,

    @NotBlank(message = "Address line is required")
    @Size(max = 500, message = "Address line must not exceed 500 characters")
    String addressLine,

    @Size(max = 1000, message = "Delivery note must not exceed 1000 characters")
    String deliveryNote,

    @JsonProperty("isDefault")
    @JsonAlias("defaultAddress")
    boolean defaultAddress,

    @NotNull(message = "Version is required")
    @Min(value = 0, message = "Version must not be negative")
    Long version
) {
}
