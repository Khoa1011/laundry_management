package com.laundry.management.servicecatalog.seed;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.demo-seed")
public record DemoCatalogSeedProperties(
    boolean enabled,
    String actorUsername,
    String branchCode
) {
}
