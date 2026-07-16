package com.laundry.management.customer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.customer.application.PhoneNormalizer;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

class PhoneNormalizerTest {

    private final PhoneNormalizer normalizer = new PhoneNormalizer();

    @ParameterizedTest
    @MethodSource("validPhones")
    void equivalentVietnameseRepresentationsHaveOneCanonicalValue(String input) {
        var phone = normalizer.normalize(input);
        assertThat(phone.e164()).isEqualTo("+84901234567");
        assertThat(phone.display()).isEqualTo("0901 234 567");
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "",
        "901234567",
        "+8490123456",
        "+849012345678",
        "+65901234567",
        "00184901234567",
        "0901ABC567"
    })
    void invalidOrUnsupportedPhonesAreRejected(String input) {
        assertThatThrownBy(() -> normalizer.normalize(input))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("valid Vietnamese phone number");
    }

    private static Stream<Arguments> validPhones() {
        return Stream.of(
            Arguments.of("0901234567"),
            Arguments.of("0901 234 567"),
            Arguments.of("0901.234.567"),
            Arguments.of("0901-234-567"),
            Arguments.of("(0901) 234 567"),
            Arguments.of("+84901234567"),
            Arguments.of("84 901 234 567")
        );
    }
}
