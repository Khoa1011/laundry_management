package com.laundry.management.inventory.operations;
import java.math.BigDecimal;
import java.time.Instant;
public record StockChangedEvent(long branchId,long warehouseId,long itemId,long documentId,long revision,long actorId,BigDecimal previous,BigDecimal current,Instant occurredAt) {}
