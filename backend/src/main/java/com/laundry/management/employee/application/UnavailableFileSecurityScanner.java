package com.laundry.management.employee.application;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class UnavailableFileSecurityScanner implements FileSecurityScanner {
    @Override
    public ScanResult scan(MultipartFile file) { return ScanResult.UNAVAILABLE; }
}
