package com.laundry.management.inventory.operations;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.common.file.PrivateFilename;
import com.laundry.management.employee.application.FileSecurityScanner;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import javax.imageio.ImageIO;
import javax.imageio.stream.MemoryCacheImageInputStream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
class ReceiptInvoiceImageValidator {
    static final int MAX_BYTES = 10 * 1024 * 1024;
    private static final long MAX_PIXELS = 25_000_000;
    private final FileSecurityScanner scanner;

    ReceiptInvoiceImageValidator(FileSecurityScanner scanner) {
        this.scanner = scanner;
    }

    Image validate(MultipartFile file) {
        if (file == null || file.isEmpty()) throw invalid();
        if (file.getSize() > MAX_BYTES) throw tooLarge();
        try (var input = file.getInputStream()) {
            byte[] bytes = input.readNBytes(MAX_BYTES + 1);
            if (bytes.length > MAX_BYTES) throw tooLarge();
            Format format = decode(bytes);
            String declared = file.getContentType();
            if (declared != null && !declared.equalsIgnoreCase("application/octet-stream")
                && !declared.equalsIgnoreCase(format.contentType)) throw invalid();
            String filename = PrivateFilename.sanitize(file.getOriginalFilename(), "invoice" + format.extension);
            String lower = filename.toLowerCase(Locale.ROOT);
            if (!lower.endsWith(format.extension) && !(format == Format.JPEG && lower.endsWith(".jpeg"))) {
                throw invalid();
            }
            if (scanner.scan(file) == FileSecurityScanner.ScanResult.REJECTED) throw invalid();
            return new Image(bytes, filename, format.contentType, format.extension,
                HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)));
        } catch (IOException exception) {
            throw invalid();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private Format decode(byte[] bytes) throws IOException {
        try (var stream = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw invalid();
            var reader = readers.next();
            try {
                Format format = switch (reader.getFormatName().toLowerCase(Locale.ROOT)) {
                    case "jpeg" -> Format.JPEG;
                    case "png" -> Format.PNG;
                    case "webp" -> Format.WEBP;
                    default -> throw invalid();
                };
                reader.setInput(stream, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height > MAX_PIXELS) throw invalid();
                reader.addIIOReadWarningListener((source, warning) -> { throw invalid(); });
                var image = reader.read(0);
                if (image == null) throw invalid();
                image.flush();
                return format;
            } catch (ApiException exception) {
                throw exception;
            } catch (RuntimeException exception) {
                throw invalid();
            } finally {
                reader.dispose();
            }
        }
    }

    static ApiException tooLarge() {
        return new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.INVENTORY_INVOICE_TOO_LARGE,
            "Invoice image is too large", "Invoice images may be up to 10 MB.");
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorCode.INVENTORY_INVOICE_INVALID_FILE,
            "Invalid invoice image", "Select a valid JPEG, PNG or WebP image up to 25 megapixels.");
    }

    private enum Format {
        JPEG("image/jpeg", ".jpg"), PNG("image/png", ".png"), WEBP("image/webp", ".webp");
        private final String contentType;
        private final String extension;

        Format(String contentType, String extension) {
            this.contentType = contentType;
            this.extension = extension;
        }
    }

    record Image(byte[] bytes, String filename, String contentType, String extension, String checksum) {}
}
