package com.laundry.management.location.api;

import com.laundry.management.location.domain.AdministrativeVersion;
import java.util.List;

public final class LocationDtos {

    private LocationDtos() {
    }

    public record DivisionResponse(
        int code,
        String name,
        String divisionType
    ) {
    }

    public enum CacheStatus {
        HIT,
        MISS,
        STALE
    }

    public record CatalogResult(
        List<DivisionResponse> items,
        CacheStatus cacheStatus,
        AdministrativeVersion version
    ) {
    }
}
