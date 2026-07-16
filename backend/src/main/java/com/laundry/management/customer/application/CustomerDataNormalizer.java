package com.laundry.management.customer.application;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class CustomerDataNormalizer {

    public String requiredText(String value, String fieldLabel) {
        String normalized = optionalText(value);
        if (normalized == null) {
            throw validation(fieldLabel + " is required.");
        }
        return normalized;
    }

    public String meaningfulName(String value) {
        String name = requiredText(value, "Full name");
        long meaningfulCharacters = name.codePoints().filter(Character::isLetterOrDigit).count();
        if (meaningfulCharacters < 2) {
            throw validation("Full name must contain at least two meaningful characters.");
        }
        return name;
    }

    public String optionalText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public String email(String value) {
        String normalized = optionalText(value);
        return normalized == null ? null : normalized.toLowerCase(Locale.ROOT);
    }

    private ApiException validation(String detail) {
        return new ApiException(
            HttpStatus.BAD_REQUEST,
            ErrorCode.VALIDATION_ERROR,
            "Validation failed",
            detail
        );
    }
}
