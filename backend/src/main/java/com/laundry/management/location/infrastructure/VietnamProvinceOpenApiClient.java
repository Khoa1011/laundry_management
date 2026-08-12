package com.laundry.management.location.infrastructure;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.laundry.management.location.api.LocationDtos;
import com.laundry.management.location.domain.AdministrativeVersion;
import java.util.List;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class VietnamProvinceOpenApiClient implements VietnamProvinceApiClient {

    private static final int MAX_DIVISIONS_PER_RESPONSE = 1000;
    private final RestClient restClient;

    public VietnamProvinceOpenApiClient(
        @Qualifier("vietnamProvinceRestClient") RestClient restClient
    ) {
        this.restClient = restClient;
    }

    @Override
    public List<LocationDtos.DivisionResponse> provinces(AdministrativeVersion version) {
        String path = version == AdministrativeVersion.V1 ? "/api/v1/p/" : "/api/v2/";
        List<UpstreamProvince> provinces = get(path, new ParameterizedTypeReference<>() {
        });
        return map(provinces);
    }

    @Override
    public List<LocationDtos.DivisionResponse> districts(int provinceCode) {
        UpstreamProvince province = get(
            "/api/v1/p/" + provinceCode + "?depth=2",
            UpstreamProvince.class
        );
        return map(Objects.requireNonNullElse(province.districts(), List.of()));
    }

    @Override
    public List<LocationDtos.DivisionResponse> wards(AdministrativeVersion version, int parentCode) {
        if (version == AdministrativeVersion.V2) {
            UpstreamProvince province = get(
                "/api/v2/p/" + parentCode + "?depth=2",
                UpstreamProvince.class
            );
            return map(Objects.requireNonNullElse(province.wards(), List.of()));
        }
        UpstreamDistrict district = get(
            "/api/v1/d/" + parentCode + "?depth=2",
            UpstreamDistrict.class
        );
        return map(Objects.requireNonNullElse(district.wards(), List.of()));
    }

    private <T> T get(String path, Class<T> responseType) {
        try {
            T body = restClient.get().uri(path).retrieve().body(responseType);
            if (body == null) {
                throw new VietnamProvinceApiException("Province API returned an empty response");
            }
            return body;
        } catch (RestClientException exception) {
            throw new VietnamProvinceApiException("Province API request failed", exception);
        }
    }

    private <T> T get(String path, ParameterizedTypeReference<T> responseType) {
        try {
            T body = restClient.get().uri(path).retrieve().body(responseType);
            if (body == null) {
                throw new VietnamProvinceApiException("Province API returned an empty response");
            }
            return body;
        } catch (RestClientException exception) {
            throw new VietnamProvinceApiException("Province API request failed", exception);
        }
    }

    private List<LocationDtos.DivisionResponse> map(List<? extends UpstreamDivision> divisions) {
        if (divisions.size() > MAX_DIVISIONS_PER_RESPONSE) {
            throw new VietnamProvinceApiException("Province API response exceeded the supported size");
        }
        return divisions.stream().map(this::map).toList();
    }

    private LocationDtos.DivisionResponse map(UpstreamDivision division) {
        if (division.code() <= 0 || division.name() == null || division.name().isBlank()) {
            throw new VietnamProvinceApiException("Province API returned an invalid division");
        }
        return new LocationDtos.DivisionResponse(
            division.code(),
            division.name().trim(),
            division.divisionType() == null ? "" : division.divisionType().trim()
        );
    }

    private interface UpstreamDivision {
        int code();
        String name();
        String divisionType();
    }

    private record UpstreamProvince(
        int code,
        String name,
        @JsonProperty("division_type") String divisionType,
        List<UpstreamDistrict> districts,
        List<UpstreamWard> wards
    ) implements UpstreamDivision {
    }

    private record UpstreamDistrict(
        int code,
        String name,
        @JsonProperty("division_type") String divisionType,
        @JsonProperty("province_code") Integer provinceCode,
        List<UpstreamWard> wards
    ) implements UpstreamDivision {
    }

    private record UpstreamWard(
        int code,
        String name,
        @JsonProperty("division_type") String divisionType,
        @JsonProperty("province_code") Integer provinceCode,
        @JsonProperty("district_code") Integer districtCode
    ) implements UpstreamDivision {
    }

    public static class VietnamProvinceApiException extends RuntimeException {

        public VietnamProvinceApiException(String message) {
            super(message);
        }

        public VietnamProvinceApiException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
