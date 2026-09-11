package com.laundry.management.realtime;

import java.time.Instant;

public record RealtimeEnvelope(String eventId, String type, Long branchId, Long entityId,
                               String entityCode, Long version, Instant occurredAt) {}
