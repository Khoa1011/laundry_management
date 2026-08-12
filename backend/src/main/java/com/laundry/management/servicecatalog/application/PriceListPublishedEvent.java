package com.laundry.management.servicecatalog.application;

import com.laundry.management.servicecatalog.domain.PriceListStatus;
import java.time.Instant;

public record PriceListPublishedEvent(
    Long priceListId,
    String priceListName,
    Long branchId,
    PriceListStatus status,
    Instant effectiveFrom,
    Instant effectiveTo,
    Long actorUserId
) {
}
