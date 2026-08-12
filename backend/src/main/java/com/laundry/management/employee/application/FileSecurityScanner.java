package com.laundry.management.employee.application;

import org.springframework.web.multipart.MultipartFile;

public interface FileSecurityScanner {
    ScanResult scan(MultipartFile file);
    enum ScanResult { CLEAN, REJECTED, UNAVAILABLE }
}
