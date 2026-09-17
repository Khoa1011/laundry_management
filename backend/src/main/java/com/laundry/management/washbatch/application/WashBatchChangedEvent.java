package com.laundry.management.washbatch.application;

import java.time.Instant;

public record WashBatchChangedEvent(Long batchId,String batchCode,Long branchId,long version,String eventType,Instant occurredAt) {}
