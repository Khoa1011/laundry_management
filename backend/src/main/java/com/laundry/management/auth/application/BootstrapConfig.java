package com.laundry.management.auth.application;

import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(BootstrapProperties.class)
public class BootstrapConfig {

    @Bean
    ApplicationRunner accessControlBootstrap(BootstrapProperties properties, BootstrapService bootstrapService) {
        return arguments -> {
            if (properties.enabled()) {
                bootstrapService.initialize(properties);
            }
        };
    }
}
