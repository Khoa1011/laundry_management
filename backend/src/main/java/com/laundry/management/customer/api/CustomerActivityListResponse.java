package com.laundry.management.customer.api;

import java.util.List;

public record CustomerActivityListResponse(
    List<CustomerActivityResponse> items,
    int page,
    int size,
    long totalElements,
    int totalPages
) {
}
