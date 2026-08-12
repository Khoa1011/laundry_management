package com.laundry.management.employee.application;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import jakarta.annotation.PostConstruct;
import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class LocalEmployeeDocumentStorage implements EmployeeDocumentStorage {
    private final Path root;

    public LocalEmployeeDocumentStorage(@Value("${app.employee-sensitive.storage-root:./private-data/employee-documents}") String root) {
        this.root = Path.of(root).toAbsolutePath().normalize();
    }

    @PostConstruct
    void initialize() {
        try { Files.createDirectories(root); }
        catch (IOException exception) { throw new IllegalStateException("Unable to initialize private employee storage", exception); }
    }

    @Override
    public StoredObject store(InputStream input) {
        LocalDate today = LocalDate.now();
        String key = "%04d/%02d/%s.bin".formatted(today.getYear(), today.getMonthValue(), UUID.randomUUID());
        Path target = resolve(key);
        Path temporary = null;
        try {
            Files.createDirectories(target.getParent());
            temporary = Files.createTempFile(target.getParent(), ".upload-", ".tmp");
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long size = 0;
            try (InputStream source = input; OutputStream output = Files.newOutputStream(temporary, StandardOpenOption.TRUNCATE_EXISTING)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = source.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                    size += read;
                }
            }
            try { Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE); }
            catch (AtomicMoveNotSupportedException exception) { Files.move(temporary, target); }
            return new StoredObject(key, size, HexFormat.of().formatHex(digest.digest()));
        } catch (IOException | NoSuchAlgorithmException exception) {
            if (temporary != null) try { Files.deleteIfExists(temporary); } catch (IOException ignored) { }
            throw storageError();
        }
    }

    @Override
    public Resource open(String storageKey) {
        Path path = resolve(storageKey);
        if (!Files.isRegularFile(path)) throw storageError();
        return new FileSystemResource(path);
    }

    @Override
    public void delete(String storageKey) {
        try { Files.deleteIfExists(resolve(storageKey)); }
        catch (IOException exception) { throw storageError(); }
    }

    private Path resolve(String storageKey) {
        Path resolved = root.resolve(storageKey).normalize();
        if (!resolved.startsWith(root)) throw storageError();
        return resolved;
    }

    private ApiException storageError() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.EMPLOYEE_DOCUMENT_STORAGE_ERROR,
            "Private document storage unavailable", "The private employee document could not be stored or opened.");
    }
}
