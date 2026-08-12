package com.laundry.management.location;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.location.api.LocationDtos;
import com.laundry.management.location.application.VietnamLocationCatalogService;
import com.laundry.management.location.application.VietnamLocationProperties;
import com.laundry.management.location.domain.AdministrativeVersion;
import com.laundry.management.location.infrastructure.VietnamProvinceApiClient;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class VietnamLocationCatalogServiceTest {

    private final MutableClock clock = new MutableClock(Instant.parse("2026-07-26T00:00:00Z"));
    private final FakeClient client = new FakeClient();
    private VietnamLocationCatalogService service;

    @BeforeEach
    void setUp() {
        VietnamLocationProperties properties = new VietnamLocationProperties();
        properties.setCacheTtl(Duration.ofMinutes(10));
        properties.setStaleTtl(Duration.ofHours(1));
        properties.setMaxEntries(8);
        service = new VietnamLocationCatalogService(client, properties, clock);
    }

    @Test
    void cachesSuccessfulCatalogLoads() {
        LocationDtos.CatalogResult first = service.provinces(AdministrativeVersion.V2);
        LocationDtos.CatalogResult second = service.provinces(AdministrativeVersion.V2);

        assertThat(first.cacheStatus()).isEqualTo(LocationDtos.CacheStatus.MISS);
        assertThat(second.cacheStatus()).isEqualTo(LocationDtos.CacheStatus.HIT);
        assertThat(second.items()).extracting(LocationDtos.DivisionResponse::name)
            .containsExactly("Thành phố Hồ Chí Minh");
        assertThat(client.calls).hasValue(1);
    }

    @Test
    void servesStaleCatalogWhenRefreshFails() {
        service.provinces(AdministrativeVersion.V2);
        clock.advance(Duration.ofMinutes(11));
        client.fail = true;

        LocationDtos.CatalogResult result = service.provinces(AdministrativeVersion.V2);

        assertThat(result.cacheStatus()).isEqualTo(LocationDtos.CacheStatus.STALE);
        assertThat(result.items()).hasSize(1);
        assertThat(client.calls).hasValue(2);
    }

    @Test
    void returnsServiceUnavailableWhenNoUsableCacheExists() {
        client.fail = true;

        assertThatThrownBy(() -> service.wards(AdministrativeVersion.V1, 769))
            .isInstanceOfSatisfying(ApiException.class, exception -> {
                assertThat(exception.getStatus().value()).isEqualTo(503);
                assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.LOCATION_CATALOG_UNAVAILABLE);
            });
    }

    private static final class FakeClient implements VietnamProvinceApiClient {

        private final AtomicInteger calls = new AtomicInteger();
        private boolean fail;

        @Override
        public List<LocationDtos.DivisionResponse> provinces(AdministrativeVersion version) {
            return result();
        }

        @Override
        public List<LocationDtos.DivisionResponse> districts(int provinceCode) {
            return result();
        }

        @Override
        public List<LocationDtos.DivisionResponse> wards(AdministrativeVersion version, int parentCode) {
            return result();
        }

        private List<LocationDtos.DivisionResponse> result() {
            calls.incrementAndGet();
            if (fail) {
                throw new IllegalStateException("upstream unavailable");
            }
            return List.of(new LocationDtos.DivisionResponse(
                79,
                "Thành phố Hồ Chí Minh",
                "thành phố trung ương"
            ));
        }
    }

    private static final class MutableClock extends Clock {

        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advance(Duration duration) {
            instant = instant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
