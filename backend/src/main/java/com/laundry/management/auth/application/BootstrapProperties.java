package com.laundry.management.auth.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.bootstrap")
public record BootstrapProperties(
    boolean enabled,
    String username,
    String password,
    String branchCode,
    String branchName
) {
}
