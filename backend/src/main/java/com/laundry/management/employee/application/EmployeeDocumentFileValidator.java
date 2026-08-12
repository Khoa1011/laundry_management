package com.laundry.management.employee.application;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class EmployeeDocumentFileValidator {
    private static final Map<String, String> EXTENSIONS = Map.of(
        "image/jpeg", ".jpg",
        "image/png", ".png",
        "application/pdf", ".pdf"
    );
    private final long imageLimit;
    private final long pdfLimit;
    private final FileSecurityScanner scanner;

    public EmployeeDocumentFileValidator(
        @Value("${app.employee-sensitive.image-max-bytes:10485760}") long imageLimit,
        @Value("${app.employee-sensitive.pdf-max-bytes:20971520}") long pdfLimit,
        FileSecurityScanner scanner
    ) {
        this.imageLimit = imageLimit;
        this.pdfLimit = pdfLimit;
        this.scanner = scanner;
    }

    public ValidatedFile validate(MultipartFile file) {
        if (file == null || file.isEmpty()) throw invalid("Select a non-empty JPEG, PNG, or PDF file.");
        String contentType = detect(file);
        String declared = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!contentType.equals(declared)) throw invalid("The declared file type does not match its content.");
        long limit = contentType.equals("application/pdf") ? pdfLimit : imageLimit;
        if (file.getSize() > limit) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.EMPLOYEE_DOCUMENT_TOO_LARGE,
                "Employee document is too large", "Images may be up to 10 MB and PDF files up to 20 MB.");
        }
        String filename = sanitizeFilename(file.getOriginalFilename(), EXTENSIONS.get(contentType));
        if (!filename.toLowerCase(Locale.ROOT).endsWith(EXTENSIONS.get(contentType))
            && !(contentType.equals("image/jpeg") && filename.toLowerCase(Locale.ROOT).endsWith(".jpeg"))) {
            throw invalid("The filename extension does not match the file content.");
        }
        if (scanner.scan(file) == FileSecurityScanner.ScanResult.REJECTED) {
            throw invalid("The file was rejected by the security scanner.");
        }
        return new ValidatedFile(filename, contentType);
    }

    private String detect(MultipartFile file) {
        byte[] header = new byte[8];
        try (InputStream input = file.getInputStream()) {
            int read = input.read(header);
            if (read >= 3 && (header[0] & 0xff) == 0xff && (header[1] & 0xff) == 0xd8 && (header[2] & 0xff) == 0xff) return "image/jpeg";
            if (read >= 8 && header[0] == (byte) 0x89 && header[1] == 0x50 && header[2] == 0x4e && header[3] == 0x47
                && header[4] == 0x0d && header[5] == 0x0a && header[6] == 0x1a && header[7] == 0x0a) return "image/png";
            if (read >= 5 && header[0] == '%' && header[1] == 'P' && header[2] == 'D' && header[3] == 'F' && header[4] == '-') return "application/pdf";
        } catch (IOException exception) {
            throw invalid("The file could not be inspected.");
        }
        throw invalid("Only JPEG, PNG, and PDF files are accepted.");
    }

    private String sanitizeFilename(String raw, String fallbackExtension) {
        String name = raw == null ? "document" + fallbackExtension : raw.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "").trim();
        name = name.replaceAll("[^A-Za-z0-9._ -]", "_");
        if (name.isBlank() || name.equals(".") || name.equals("..")) name = "document" + fallbackExtension;
        if (name.length() > 180) name = name.substring(name.length() - 180);
        return name;
    }

    private ApiException invalid(String detail) {
        return new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorCode.EMPLOYEE_DOCUMENT_INVALID_FILE,
            "Invalid employee document", detail);
    }

    public record ValidatedFile(String filename, String contentType) { }
}
