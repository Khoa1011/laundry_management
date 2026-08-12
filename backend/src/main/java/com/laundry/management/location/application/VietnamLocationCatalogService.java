package com.laundry.management.location.application;

import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.location.api.LocationDtos;
import com.laundry.management.location.domain.AdministrativeVersion;
import com.laundry.management.location.infrastructure.VietnamProvinceApiClient;
import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import java.util.stream.IntStream;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

@Service
public class VietnamLocationCatalogService {

    private static final int LOCK_STRIPES = 64;

    private final VietnamProvinceApiClient apiClient;
    private final VietnamLocationProperties properties;
    private final Clock clock;
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private final Object[] loadLocks = IntStream.range(0, LOCK_STRIPES)
        .mapToObj(ignored -> new Object())
        .toArray();

    public VietnamLocationCatalogService(
        VietnamProvinceApiClient apiClient,
        VietnamLocationProperties properties,
        Clock locationCacheClock
    ) {
        this.apiClient = apiClient;
        this.properties = properties;
        this.clock = locationCacheClock;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).LOCATION_READ)")
    public LocationDtos.CatalogResult provinces(AdministrativeVersion version) {
        return load("provinces:" + version, version, () -> apiClient.provinces(version));
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).LOCATION_READ)")
    public LocationDtos.CatalogResult districts(int provinceCode) {
        return load(
            "districts:V1:" + provinceCode,
            AdministrativeVersion.V1,
            () -> apiClient.districts(provinceCode)
        );
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).LOCATION_READ)")
    public LocationDtos.CatalogResult wards(AdministrativeVersion version, int parentCode) {
        return load(
            "wards:" + version + ":" + parentCode,
            version,
            () -> apiClient.wards(version, parentCode)
        );
    }

    private LocationDtos.CatalogResult load(
        String key,
        AdministrativeVersion version,
        Supplier<List<LocationDtos.DivisionResponse>> loader
    ) {
        Instant now = clock.instant();
        CacheEntry current = cache.get(key);
        if (current != null && current.freshUntil().isAfter(now)) {
            return result(current.items(), LocationDtos.CacheStatus.HIT, version);
        }

        synchronized (loadLocks[Math.floorMod(key.hashCode(), loadLocks.length)]) {
            now = clock.instant();
            current = cache.get(key);
            if (current != null && current.freshUntil().isAfter(now)) {
                return result(current.items(), LocationDtos.CacheStatus.HIT, version);
            }
            try {
                List<LocationDtos.DivisionResponse> loaded = List.copyOf(loader.get());
                CacheEntry refreshed = new CacheEntry(
                    loaded,
                    now,
                    now.plus(properties.getCacheTtl()),
                    now.plus(properties.getCacheTtl()).plus(properties.getStaleTtl())
                );
                makeRoomFor(key);
                cache.put(key, refreshed);
                return result(loaded, LocationDtos.CacheStatus.MISS, version);
            } catch (RuntimeException exception) {
                if (current != null && current.staleUntil().isAfter(now)) {
                    return result(current.items(), LocationDtos.CacheStatus.STALE, version);
                }
                throw unavailable();
            }
        }
    }

    private void makeRoomFor(String key) {
        if (cache.containsKey(key) || cache.size() < properties.getMaxEntries()) {
            return;
        }
        cache.entrySet().stream()
            .min(Comparator.comparing(entry -> entry.getValue().loadedAt()))
            .map(Map.Entry::getKey)
            .ifPresent(cache::remove);
    }

    private LocationDtos.CatalogResult result(
        List<LocationDtos.DivisionResponse> items,
        LocationDtos.CacheStatus status,
        AdministrativeVersion version
    ) {
        return new LocationDtos.CatalogResult(items, status, version);
    }

    private ApiException unavailable() {
        return new ApiException(
            HttpStatus.SERVICE_UNAVAILABLE,
            ErrorCode.LOCATION_CATALOG_UNAVAILABLE,
            "Location catalog unavailable",
            "The Vietnamese administrative location catalog is temporarily unavailable."
        );
    }

    private record CacheEntry(
        List<LocationDtos.DivisionResponse> items,
        Instant loadedAt,
        Instant freshUntil,
        Instant staleUntil
    ) {
    }
}
