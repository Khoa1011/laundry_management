package com.laundry.management.customer.api;

import java.util.List;

public record CustomerListResponse(
    List<CustomerListItemResponse> items,
    int page,
    int size,
    long totalElements,
    int totalPages,
    List<SortItemResponse> sort
) {

    public record SortItemResponse(String property, String direction) {
    }
}
