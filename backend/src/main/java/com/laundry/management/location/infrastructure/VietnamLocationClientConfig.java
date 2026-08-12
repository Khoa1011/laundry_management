package com.laundry.management.location.infrastructure;

import com.laundry.management.location.application.VietnamLocationProperties;
import java.net.http.HttpClient;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(VietnamLocationProperties.class)
public class VietnamLocationClientConfig {

    @Bean
    @Qualifier("vietnamProvinceRestClient")
    RestClient vietnamProvinceRestClient(VietnamLocationProperties properties) {
        HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(properties.getConnectTimeout())
            .followRedirects(HttpClient.Redirect.NEVER)
            .version(HttpClient.Version.HTTP_2)
            .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.getReadTimeout());
        return RestClient.builder()
            .baseUrl(properties.getBaseUrl().toString())
            .requestFactory(requestFactory)
            .defaultHeader("User-Agent", "laundry-management-location-proxy/1.0")
            .build();
    }

    @Bean
    Clock locationCacheClock() {
        return Clock.systemUTC();
    }
}
