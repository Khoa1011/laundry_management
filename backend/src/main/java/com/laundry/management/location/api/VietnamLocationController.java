package com.laundry.management.location.api;

import com.laundry.management.location.application.VietnamLocationCatalogService;
import com.laundry.management.location.domain.AdministrativeVersion;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Positive;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/locations/vietnam")
public class VietnamLocationController {

    private static final String CLIENT_CACHE_CONTROL =
        "private, max-age=86400, stale-while-revalidate=604800, stale-if-error=604800";

    private final VietnamLocationCatalogService catalogService;

    public VietnamLocationController(VietnamLocationCatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping("/v2/provinces")
    public ResponseEntity<List<LocationDtos.DivisionResponse>> currentProvinces() {
        return response(catalogService.provinces(AdministrativeVersion.V2));
    }

    @GetMapping("/v2/provinces/{provinceCode}/wards")
    public ResponseEntity<List<LocationDtos.DivisionResponse>> currentWards(
        @PathVariable @Positive @Max(99999) int provinceCode
    ) {
        return response(catalogService.wards(AdministrativeVersion.V2, provinceCode));
    }

    @GetMapping("/v1/provinces")
    public ResponseEntity<List<LocationDtos.DivisionResponse>> legacyProvinces() {
        return response(catalogService.provinces(AdministrativeVersion.V1));
    }

    @GetMapping("/v1/provinces/{provinceCode}/districts")
    public ResponseEntity<List<LocationDtos.DivisionResponse>> legacyDistricts(
        @PathVariable @Positive @Max(99999) int provinceCode
    ) {
        return response(catalogService.districts(provinceCode));
    }

    @GetMapping("/v1/districts/{districtCode}/wards")
    public ResponseEntity<List<LocationDtos.DivisionResponse>> legacyWards(
        @PathVariable @Positive @Max(99999) int districtCode
    ) {
        return response(catalogService.wards(AdministrativeVersion.V1, districtCode));
    }

    private ResponseEntity<List<LocationDtos.DivisionResponse>> response(
        LocationDtos.CatalogResult result
    ) {
        return ResponseEntity.ok()
            .header("Cache-Control", CLIENT_CACHE_CONTROL)
            .header("Vary", "Authorization")
            .header("X-Location-Cache", result.cacheStatus().name())
            .header("X-Location-Version", result.version().name())
            .body(result.items());
    }
}
