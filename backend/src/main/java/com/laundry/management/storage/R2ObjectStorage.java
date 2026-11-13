package com.laundry.management.storage;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import jakarta.annotation.PreDestroy;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

@Component
public class R2ObjectStorage implements PrivateObjectStorage {
    private final S3Client client;
    private final String bucket;

    public R2ObjectStorage(
        @Value("${app.r2.enabled:false}") boolean enabled,
        @Value("${app.r2.account-id:}") String account,
        @Value("${app.r2.bucket:}") String bucket,
        @Value("${app.r2.access-key-id:}") String accessKey,
        @Value("${app.r2.secret-access-key:}") String secretKey,
        @Value("${app.r2.endpoint:}") String configuredEndpoint
    ) {
        this.bucket = bucket;
        String endpoint = "https://" + account + ".r2.cloudflarestorage.com";
        boolean valid = account.matches("[a-fA-F0-9]{32}") && !bucket.isBlank()
            && !accessKey.isBlank() && !secretKey.isBlank()
            && (configuredEndpoint.isBlank() || configuredEndpoint.equals(endpoint));
        this.client = enabled && valid ? client(URI.create(endpoint), accessKey, secretKey) : null;
    }

    static S3Client client(URI endpoint, String accessKey, String secretKey) {
        return S3Client.builder()
            .endpointOverride(endpoint)
            .region(Region.of("auto"))
            .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
            .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).chunkedEncodingEnabled(false).build())
            .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
            .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
            .overrideConfiguration(config -> config.apiCallTimeout(Duration.ofSeconds(35))
                .apiCallAttemptTimeout(Duration.ofSeconds(15)))
            .build();
    }

    @Override
    public boolean ready() {
        return client != null;
    }

    @Override
    public void put(String key, byte[] bytes, String contentType) {
        requireReady();
        try {
            client.putObject(request -> request.bucket(bucket).key(key).contentType(contentType)
                .contentLength((long) bytes.length), RequestBody.fromBytes(bytes));
        } catch (SdkException exception) {
            throw unavailable();
        }
    }

    @Override
    public InputStream open(String key) {
        requireReady();
        try {
            return client.getObject(request -> request.bucket(bucket).key(key));
        } catch (SdkException exception) {
            throw unavailable();
        }
    }

    @Override
    public void delete(String key) {
        requireReady();
        try {
            client.deleteObject(request -> request.bucket(bucket).key(key));
        } catch (SdkException exception) {
            throw unavailable();
        }
    }

    @PreDestroy
    void close() {
        if (client != null) client.close();
    }

    private void requireReady() {
        if (!ready()) throw notConfigured();
    }

    public static ApiException notConfigured() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.INVENTORY_INVOICE_STORAGE_NOT_CONFIGURED,
            "Invoice image storage is not configured", "Ask an administrator to configure private invoice storage.");
    }

    private static ApiException unavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.INVENTORY_INVOICE_STORAGE_UNAVAILABLE,
            "Invoice image storage unavailable", "Retry the invoice image operation.");
    }
}
