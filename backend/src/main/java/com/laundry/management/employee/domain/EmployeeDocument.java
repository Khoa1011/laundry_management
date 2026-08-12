package com.laundry.management.employee.domain;

import com.laundry.management.auth.domain.UserAccount;
import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "employee_documents")
public class EmployeeDocument {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "employee_id", nullable = false) private Employee employee;
    @Enumerated(EnumType.STRING) @Column(name = "document_type", nullable = false, length = 40) private EmployeeDocumentType documentType;
    @Column(name = "original_filename", nullable = false, length = 255) private String originalFilename;
    @Column(name = "storage_key", nullable = false, length = 255) private String storageKey;
    @Column(name = "content_type", nullable = false, length = 100) private String contentType;
    @Column(name = "size_bytes", nullable = false) private long sizeBytes;
    @Column(name = "checksum_sha256", nullable = false, length = 64) private String checksumSha256;
    @Column(length = 500) private String description;
    @Column(name = "document_version", nullable = false) private int documentVersion;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private EmployeeDocumentStatus status;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "replaces_document_id") private EmployeeDocument replacesDocument;
    @Column(name = "deleted_at") private Instant deletedAt;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "deleted_by") private UserAccount deletedBy;
    @Column(name = "delete_reason", length = 500) private String deleteReason;
    @Version @Column(name = "record_version", nullable = false) private long recordVersion;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "created_by", nullable = false, updatable = false) private UserAccount createdBy;

    protected EmployeeDocument() { }

    public EmployeeDocument(Employee employee, EmployeeDocumentType documentType, String originalFilename,
                            String storageKey, String contentType, long sizeBytes, String checksumSha256,
                            String description, int documentVersion, EmployeeDocument replacesDocument,
                            UserAccount actor) {
        this.employee = employee;
        this.documentType = documentType;
        this.originalFilename = originalFilename;
        this.storageKey = storageKey;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.checksumSha256 = checksumSha256;
        this.description = description;
        this.documentVersion = documentVersion;
        this.replacesDocument = replacesDocument;
        this.status = EmployeeDocumentStatus.ACTIVE;
        this.createdBy = actor;
    }

    public void markReplaced() { this.status = EmployeeDocumentStatus.REPLACED; }
    public void delete(String reason, UserAccount actor) {
        this.status = EmployeeDocumentStatus.DELETED;
        this.deletedAt = Instant.now();
        this.deletedBy = actor;
        this.deleteReason = reason;
    }

    public Long getId() { return id; }
    public Employee getEmployee() { return employee; }
    public EmployeeDocumentType getDocumentType() { return documentType; }
    public String getOriginalFilename() { return originalFilename; }
    public String getStorageKey() { return storageKey; }
    public String getContentType() { return contentType; }
    public long getSizeBytes() { return sizeBytes; }
    public String getChecksumSha256() { return checksumSha256; }
    public String getDescription() { return description; }
    public int getDocumentVersion() { return documentVersion; }
    public EmployeeDocumentStatus getStatus() { return status; }
    public EmployeeDocument getReplacesDocument() { return replacesDocument; }
    public Instant getDeletedAt() { return deletedAt; }
    public String getDeleteReason() { return deleteReason; }
    public long getRecordVersion() { return recordVersion; }
    public Instant getCreatedAt() { return createdAt; }
    public UserAccount getCreatedBy() { return createdBy; }
}
