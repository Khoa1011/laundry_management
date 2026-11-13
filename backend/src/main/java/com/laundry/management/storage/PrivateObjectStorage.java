package com.laundry.management.storage;

import java.io.InputStream;

public interface PrivateObjectStorage {
    boolean ready();
    void put(String key, byte[] bytes, String contentType);
    InputStream open(String key);
    void delete(String key);
}
