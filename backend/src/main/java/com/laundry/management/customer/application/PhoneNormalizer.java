package com.laundry.management.customer.application;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class PhoneNormalizer {

    private static final Pattern SEPARATORS = Pattern.compile("[\\s.\\-()]");
    private static final Pattern SUBSCRIBER = Pattern.compile("[2-9]\\d{8}");

    public NormalizedPhone normalize(String rawPhone) {
        if (rawPhone == null) {
            throw invalidPhone();
        }
        String compact = SEPARATORS.matcher(rawPhone.trim()).replaceAll("");
        String subscriber;
        if (compact.startsWith("+84")) {
            subscriber = compact.substring(3);
        } else if (compact.startsWith("84")) {
            subscriber = compact.substring(2);
        } else if (compact.startsWith("0")) {
            subscriber = compact.substring(1);
        } else {
            throw invalidPhone();
        }

        if (!SUBSCRIBER.matcher(subscriber).matches()) {
            throw invalidPhone();
        }
        String national = "0" + subscriber;
        String display = national.substring(0, 4) + " " + national.substring(4, 7) + " " + national.substring(7);
        return new NormalizedPhone("+84" + subscriber, display);
    }

    public Optional<String> tryNormalizeForSearch(String rawSearch) {
        try {
            return Optional.of(normalize(rawSearch).e164());
        } catch (ApiException ignored) {
            return Optional.empty();
        }
    }

    public String mask(String normalizedPhone) {
        if (normalizedPhone == null || normalizedPhone.length() < 6) {
            return "***";
        }
        return normalizedPhone.substring(0, 3) + "******" + normalizedPhone.substring(normalizedPhone.length() - 3);
    }

    private ApiException invalidPhone() {
        return new ApiException(
            HttpStatus.BAD_REQUEST,
            ErrorCode.VALIDATION_ERROR,
            "Invalid phone number",
            "Use a valid Vietnamese phone number such as 0901234567 or +84901234567."
        );
    }
}
