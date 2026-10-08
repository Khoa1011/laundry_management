package com.laundry.management.sorting.application;

import java.time.Instant;

public record SortingChangedEvent(Long bagId, String bagCode, Long branchId, long version,
    String eventType, Instant occurredAt) {}
