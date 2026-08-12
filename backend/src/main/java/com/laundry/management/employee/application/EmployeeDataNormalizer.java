package com.laundry.management.employee.application;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class EmployeeDataNormalizer {

    private static final Pattern PHONE_SEPARATORS = Pattern.compile("[\\s.\\-()]");
    private static final Pattern PHONE_SUBSCRIBER = Pattern.compile("[2-9]\\d{8}");

    public String meaningfulName(String value) {
        String name = requiredText(value, "Full name");
        if (name.codePoints().filter(Character::isLetterOrDigit).count() < 2) {
            throw validation("Full name must contain at least two meaningful characters.");
        }
        return name;
    }

    public NormalizedPhone phone(String value) {
        String optional = optionalText(value);
        if (optional == null) {
            return new NormalizedPhone(null, null);
        }
        String compact = PHONE_SEPARATORS.matcher(optional).replaceAll("");
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
        if (!PHONE_SUBSCRIBER.matcher(subscriber).matches()) {
            throw invalidPhone();
        }
        String national = "0" + subscriber;
        return new NormalizedPhone(
            "+84" + subscriber,
            national.substring(0, 4) + " " + national.substring(4, 7) + " " + national.substring(7)
        );
    }

    public String email(String value) {
        String normalized = optionalText(value);
        return normalized == null ? null : normalized.toLowerCase(Locale.ROOT);
    }

    public String optionalText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public String requiredText(String value, String field) {
        String normalized = optionalText(value);
        if (normalized == null) {
            throw validation(field + " is required.");
        }
        return normalized;
    }

    private ApiException invalidPhone() {
        return validation("Use a valid Vietnamese phone number such as 0901234567 or +84901234567.");
    }

    private ApiException validation(String detail) {
        return new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, "Validation failed", detail);
    }

    public record NormalizedPhone(String normalized, String display) {
    }
}
