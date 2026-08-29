package com.laundry.management.servicecatalog.seed;

import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

@Configuration
@EnableConfigurationProperties(DemoCatalogSeedProperties.class)
public class DemoCatalogSeedConfig {

    @Bean
    @Order(100)
    @ConditionalOnProperty(prefix = "app.demo-seed", name = "enabled", havingValue = "true")
    ApplicationRunner demoCatalogSeedRunner(
        DemoCatalogSeedProperties properties,
        DemoCatalogSeedService seedService
    ) {
        return arguments -> seedService.initialize(properties);
    }
}
