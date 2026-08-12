package com.laundry.management.location.infrastructure;

import com.laundry.management.location.api.LocationDtos;
import com.laundry.management.location.domain.AdministrativeVersion;
import java.util.List;

public interface VietnamProvinceApiClient {

    List<LocationDtos.DivisionResponse> provinces(AdministrativeVersion version);

    List<LocationDtos.DivisionResponse> districts(int provinceCode);

    List<LocationDtos.DivisionResponse> wards(AdministrativeVersion version, int parentCode);
}
