package com.laundry.management.order.domain;

public enum OrderHistoryAction {
    CREATED, UPDATED, STARTED_PROCESSING, MARKED_READY, COMPLETED, CANCELLED, REOPENED,
    LABEL_PRINT_REQUESTED, BAG_ADDED, BAG_VOIDED
}
