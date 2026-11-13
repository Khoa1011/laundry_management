package com.laundry.management.inventory.operations;

import java.io.IOException;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/inventory/documents/{documentId}/invoice-images")
public class ReceiptInvoiceController {
    private final ReceiptInvoiceService invoices;

    public ReceiptInvoiceController(ReceiptInvoiceService invoices) {
        this.invoices = invoices;
    }

    @GetMapping
    public ResponseEntity<ReceiptInvoiceService.Listing> list(@PathVariable long documentId, @RequestParam long branchId,
        @RequestParam(defaultValue = "false") boolean history) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(invoices.list(documentId, branchId, history));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ReceiptInvoiceService.Metadata upload(@PathVariable long documentId, @RequestParam long branchId,
        @RequestHeader("Idempotency-Key") UUID command, @RequestPart("file") MultipartFile file) {
        return invoices.upload(documentId, branchId, null, command, file);
    }

    @PostMapping(path = "/{imageId}/replace", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ReceiptInvoiceService.Metadata replace(@PathVariable long documentId, @RequestParam long branchId,
        @PathVariable UUID imageId, @RequestHeader("Idempotency-Key") UUID command, @RequestPart("file") MultipartFile file) {
        return invoices.upload(documentId, branchId, imageId, command, file);
    }

    @GetMapping("/{imageId}/content")
    public void content(@PathVariable long documentId, @RequestParam long branchId, @PathVariable UUID imageId,
        HttpServletResponse response) throws IOException {
        var download = invoices.open(documentId, branchId, imageId);
        try (var input = download.stream()) {
            response.setContentType(download.metadata().contentType());
            response.setContentLengthLong(download.metadata().byteSize());
            response.setHeader(HttpHeaders.CACHE_CONTROL, "private, no-store");
            response.setHeader(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.inline().filename(download.metadata().originalName()).build().toString());
            response.setHeader("X-Content-Type-Options", "nosniff");
            input.transferTo(response.getOutputStream());
        }
    }

    @DeleteMapping("/{imageId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable long documentId, @RequestParam long branchId, @PathVariable UUID imageId) {
        invoices.remove(documentId, branchId, imageId);
    }
}
