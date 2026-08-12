package com.laundry.management.employee.application;

import java.io.InputStream;
import org.springframework.core.io.Resource;

public interface EmployeeDocumentStorage {
    StoredObject store(InputStream input);
    Resource open(String storageKey);
    void delete(String storageKey);

    record StoredObject(String storageKey, long sizeBytes, String checksumSha256) { }
}
