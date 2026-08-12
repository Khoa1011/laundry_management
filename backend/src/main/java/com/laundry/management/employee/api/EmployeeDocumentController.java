package com.laundry.management.employee.api;

import com.laundry.management.employee.application.EmployeeDocumentService;
import com.laundry.management.employee.domain.EmployeeDocumentStatus;
import com.laundry.management.employee.domain.EmployeeDocumentType;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/employees/{employeeId}/documents")
public class EmployeeDocumentController {
    private final EmployeeDocumentService service;
    public EmployeeDocumentController(EmployeeDocumentService service) { this.service = service; }

    @GetMapping
    public EmployeeSensitiveDtos.DocumentListResponse list(
        @PathVariable Long employeeId,
        @RequestParam(defaultValue = "ACTIVE") EmployeeDocumentStatus status,
        @RequestParam(required = false) EmployeeDocumentType type,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) { return service.list(employeeId, status, type, page, size); }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EmployeeSensitiveDtos.DocumentResponse> upload(
        @PathVariable Long employeeId,
        @RequestParam EmployeeDocumentType type,
        @RequestParam(required = false) String description,
        @RequestPart("file") MultipartFile file
    ) {
        var created = service.upload(employeeId, type, description, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping(value = "/{documentId}/replacement", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public EmployeeSensitiveDtos.DocumentResponse replace(
        @PathVariable Long employeeId,
        @PathVariable Long documentId,
        @RequestParam(required = false) String description,
        @RequestPart("file") MultipartFile file
    ) { return service.replace(employeeId, documentId, description, file); }

    @DeleteMapping("/{documentId}")
    public ResponseEntity<Void> delete(
        @PathVariable Long employeeId,
        @PathVariable Long documentId,
        @Valid @RequestBody EmployeeSensitiveDtos.DocumentDeleteRequest request
    ) { service.delete(employeeId, documentId, request); return ResponseEntity.noContent().build(); }

    @GetMapping("/{documentId}/content")
    public ResponseEntity<Resource> content(
        @PathVariable Long employeeId,
        @PathVariable Long documentId,
        @RequestParam(defaultValue = "false") boolean download
    ) {
        var value = service.open(employeeId, documentId, download);
        ContentDisposition disposition = (download ? ContentDisposition.attachment() : ContentDisposition.inline())
            .filename(value.filename(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(value.contentType()))
            .contentLength(value.sizeBytes())
            .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
            .header("X-Content-Type-Options", "nosniff")
            .header(HttpHeaders.CACHE_CONTROL, "private, no-store, max-age=0")
            .header("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox")
            .body(value.resource());
    }
}
