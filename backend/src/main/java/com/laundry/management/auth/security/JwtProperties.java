package com.laundry.management.auth.security;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.security.jwt")
public record JwtProperties(String secret, Duration expiration) {

    public JwtProperties {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException("APP_JWT_SECRET must contain at least 32 characters");
        }
        if (expiration == null || expiration.isZero() || expiration.isNegative()) {
            throw new IllegalStateException("APP_JWT_EXPIRATION must be a positive duration");
        }
    }
}
