package com.laundry.management.location.application;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.location.domain.AdministrativeVersion;
import org.springframework.http.HttpStatus;

public final class AdministrativeAddressValidator {

    private AdministrativeAddressValidator() {
    }

    public static void validate(
        AdministrativeVersion version,
        String province,
        Integer provinceCode,
        String district,
        Integer districtCode,
        String ward,
        Integer wardCode
    ) {
        if (version == null) {
            if (provinceCode != null || districtCode != null || wardCode != null) {
                throw invalid("Administrative codes require an address version.");
            }
            return;
        }
        requirePair(province, provinceCode, "Province");
        requirePair(district, districtCode, "District");
        requirePair(ward, wardCode, "Ward");
        if (version == AdministrativeVersion.V2 && (present(district) || districtCode != null)) {
            throw invalid("Current V2 addresses do not contain a district.");
        }
        if ((present(district) || present(ward)) && !present(province)) {
            throw invalid("Select a province before its subdivisions.");
        }
        if (version == AdministrativeVersion.V1 && present(ward) && !present(district)) {
            throw invalid("Select a district before a legacy ward.");
        }
    }

    private static void requirePair(String name, Integer code, String label) {
        if (present(name) != (code != null)) {
            throw invalid(label + " name and code must be provided together.");
        }
    }

    private static boolean present(String value) {
        return value != null && !value.isBlank();
    }

    private static ApiException invalid(String detail) {
        return new ApiException(
            HttpStatus.BAD_REQUEST,
            ErrorCode.VALIDATION_ERROR,
            "Invalid administrative address",
            detail
        );
    }
}
