package com.laundry.management.employee.application;

import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.employee.api.EmployeeSensitiveDtos;
import com.laundry.management.employee.domain.*;
import com.laundry.management.employee.infrastructure.EmployeeDocumentRepository;
import java.io.IOException;
import java.util.Map;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

@Service
public class EmployeeDocumentService {
    private static final int MAX_PAGE_SIZE = 100;
    private final EmployeeDocumentRepository repository;
    private final EmployeeSensitiveAccessService access;
    private final EmployeeDocumentStorage storage;
    private final EmployeeDocumentFileValidator validator;
    private final EmployeeAuditService auditService;
    private final TransactionTemplate transactions;

    public EmployeeDocumentService(EmployeeDocumentRepository repository,
                                   EmployeeSensitiveAccessService access,
                                   EmployeeDocumentStorage storage,
                                   EmployeeDocumentFileValidator validator,
                                   EmployeeAuditService auditService,
                                   PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.access = access;
        this.storage = storage;
        this.validator = validator;
        this.auditService = auditService;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_FILE_READ)")
    @Transactional
    public EmployeeSensitiveDtos.DocumentListResponse list(Long employeeId, EmployeeDocumentStatus status,
                                                           EmployeeDocumentType type, int page, int size) {
        validatePage(page, size);
        Employee employee = access.employee(employeeId);
        var result = repository.search(employeeId, status, type,
            PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        auditService.record(employee, EmployeeAuditAction.DOCUMENT_VIEWED, Map.of(),
            Map.of("page", page, "status", status == null ? "ALL" : status.name()), null, null, access.actor());
        return new EmployeeSensitiveDtos.DocumentListResponse(result.getContent().stream().map(this::map).toList(),
            result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_FILE_UPLOAD)")
    public EmployeeSensitiveDtos.DocumentResponse upload(Long employeeId, EmployeeDocumentType type,
                                                         String description, MultipartFile file) {
        var valid = validator.validate(file);
        EmployeeDocumentStorage.StoredObject stored = store(file);
        try {
            return transactions.execute(status -> {
                Employee employee = access.employeeForUpdate(employeeId);
                UserAccount actor = access.actor();
                int version = repository.maxVersion(employeeId, type) + 1;
                EmployeeDocument created = repository.saveAndFlush(new EmployeeDocument(employee, type,
                    valid.filename(), stored.storageKey(), valid.contentType(), stored.sizeBytes(),
                    stored.checksumSha256(), clean(description), version, null, actor));
                auditService.record(employee, EmployeeAuditAction.DOCUMENT_UPLOADED, Map.of(),
                    Map.of("documentId", created.getId(), "documentType", type.name(), "documentVersion", version),
                    null, null, actor);
                return map(created);
            });
        } catch (RuntimeException exception) {
            deleteQuietly(stored.storageKey());
            throw exception;
        }
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_FILE_REPLACE)")
    public EmployeeSensitiveDtos.DocumentResponse replace(Long employeeId, Long documentId,
                                                          String description, MultipartFile file) {
        var valid = validator.validate(file);
        EmployeeDocumentStorage.StoredObject stored = store(file);
        try {
            return transactions.execute(status -> {
                Employee employee = access.employeeForUpdate(employeeId);
                EmployeeDocument previous = repository.findOwnedForUpdate(employeeId, documentId)
                    .orElseThrow(this::notFound);
                if (previous.getStatus() != EmployeeDocumentStatus.ACTIVE) throw notFound();
                UserAccount actor = access.actor();
                previous.markReplaced();
                int version = repository.maxVersion(employeeId, previous.getDocumentType()) + 1;
                EmployeeDocument created = repository.save(new EmployeeDocument(employee, previous.getDocumentType(),
                    valid.filename(), stored.storageKey(), valid.contentType(), stored.sizeBytes(),
                    stored.checksumSha256(), clean(description), version, previous, actor));
                repository.flush();
                auditService.record(employee, EmployeeAuditAction.DOCUMENT_REPLACED,
                    Map.of("documentId", previous.getId()),
                    Map.of("documentId", created.getId(), "documentVersion", version), null, null, actor);
                return map(created);
            });
        } catch (RuntimeException exception) {
            deleteQuietly(stored.storageKey());
            throw exception;
        }
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_FILE_DELETE)")
    @Transactional
    public void delete(Long employeeId, Long documentId, EmployeeSensitiveDtos.DocumentDeleteRequest request) {
        Employee employee = access.employeeForUpdate(employeeId);
        EmployeeDocument document = repository.findOwnedForUpdate(employeeId, documentId).orElseThrow(this::notFound);
        if (document.getStatus() == EmployeeDocumentStatus.DELETED) throw notFound();
        if (request.recordVersion() != document.getRecordVersion()) throw versionConflict();
        document.delete(request.reason().trim(), access.actor());
        auditService.record(employee, EmployeeAuditAction.DOCUMENT_DELETED,
            Map.of("documentId", documentId), Map.of("status", EmployeeDocumentStatus.DELETED.name()),
            request.reason().trim(), null, access.actor());
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).EMPLOYEE_FILE_DOWNLOAD)")
    @Transactional
    public Download open(Long employeeId, Long documentId, boolean download) {
        Employee employee = access.employee(employeeId);
        EmployeeDocument document = repository.findOwned(employeeId, documentId).orElseThrow(this::notFound);
        if (document.getStatus() == EmployeeDocumentStatus.DELETED) throw notFound();
        Resource resource = storage.open(document.getStorageKey());
        auditService.record(employee, download ? EmployeeAuditAction.DOCUMENT_DOWNLOADED : EmployeeAuditAction.DOCUMENT_PREVIEWED, Map.of(),
            Map.of("documentId", documentId), null, null, access.actor());
        return new Download(resource, document.getOriginalFilename(), document.getContentType(), document.getSizeBytes());
    }

    private EmployeeDocumentStorage.StoredObject store(MultipartFile file) {
        try { return storage.store(file.getInputStream()); }
        catch (IOException exception) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.EMPLOYEE_DOCUMENT_STORAGE_ERROR,
                "Private document storage unavailable", "The uploaded employee document could not be read.");
        }
    }

    private EmployeeSensitiveDtos.DocumentResponse map(EmployeeDocument value) {
        return new EmployeeSensitiveDtos.DocumentResponse(value.getId(), value.getDocumentType(),
            value.getOriginalFilename(), value.getContentType(), value.getSizeBytes(), value.getDescription(),
            value.getDocumentVersion(), value.getStatus(),
            value.getReplacesDocument() == null ? null : value.getReplacesDocument().getId(),
            value.getDeletedAt(), value.getDeleteReason(), value.getRecordVersion(),
            new EmployeeSensitiveDtos.ActorResponse(value.getCreatedBy().getId(), value.getCreatedBy().getDisplayName()),
            value.getCreatedAt());
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                size > MAX_PAGE_SIZE ? ErrorCode.PAGE_SIZE_EXCEEDED : ErrorCode.VALIDATION_ERROR,
                "Invalid pagination", "Page must not be negative and size must be between 1 and 100.");
        }
    }

    private String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private void deleteQuietly(String storageKey) {
        try { storage.delete(storageKey); } catch (RuntimeException ignored) { }
    }
    private ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, ErrorCode.EMPLOYEE_DOCUMENT_NOT_FOUND,
        "Employee document not found", "The employee document does not exist or is not available."); }
    private ApiException versionConflict() { return new ApiException(HttpStatus.CONFLICT, ErrorCode.EMPLOYEE_VERSION_CONFLICT,
        "Employee document version conflict", "The document changed. Reload it before continuing."); }
    public record Download(Resource resource, String filename, String contentType, long sizeBytes) { }
}
