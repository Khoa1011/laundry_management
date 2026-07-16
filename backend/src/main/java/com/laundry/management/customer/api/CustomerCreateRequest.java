package com.laundry.management.customer.api;

import com.laundry.management.customer.domain.CustomerSource;
import com.laundry.management.customer.domain.CustomerType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record CustomerCreateRequest(
    @NotBlank(message = "Full name is required")
    @Size(min = 2, max = 150, message = "Full name must contain between 2 and 150 characters")
    String fullName,

    @NotBlank(message = "Phone number is required")
    @Size(max = 30, message = "Phone number must not exceed 30 characters")
    String phone,

    @Email(message = "Email address is invalid")
    @Size(max = 254, message = "Email must not exceed 254 characters")
    String email,

    @PastOrPresent(message = "Birth date cannot be in the future")
    LocalDate birthDate,

    @NotNull(message = "Customer type is required")
    CustomerType customerType,

    CustomerSource source,

    @Size(max = 2000, message = "Note must not exceed 2000 characters")
    String note,

    Long branchId,

    @Valid
    CustomerAddressCreateRequest initialAddress
) {
}
