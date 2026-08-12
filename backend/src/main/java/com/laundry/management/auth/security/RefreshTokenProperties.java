package com.laundry.management.auth.security;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.security.refresh-token")
public record RefreshTokenProperties(Duration expiration, boolean secureCookie) {

    public RefreshTokenProperties {
        if (expiration == null || expiration.isZero() || expiration.isNegative()) {
            throw new IllegalArgumentException("Refresh token expiration must be positive");
        }
    }
}
