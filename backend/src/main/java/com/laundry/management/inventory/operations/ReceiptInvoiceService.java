package com.laundry.management.inventory.operations;

import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.operations.application.CatalogPersistence;
import com.laundry.management.operations.application.OperationsAccess;
import com.laundry.management.storage.PrivateObjectStorage;
import com.laundry.management.storage.R2ObjectStorage;
import java.io.InputStream;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ReceiptInvoiceService {
    private static final Logger LOG = LoggerFactory.getLogger(ReceiptInvoiceService.class);
    private static final String TABLE = "inventory_receipt_invoices";
    private static final DateTimeFormatter DIRECTORY = DateTimeFormatter.ofPattern("uuuu/MM", Locale.ROOT)
        .withZone(ZoneOffset.UTC);
    private final StockStore db;
    private final StockService stock;
    private final OperationsAccess access;
    private final CatalogPersistence audit;
    private final PrivateObjectStorage storage;
    private final ReceiptInvoiceImageValidator validator;
    private final TransactionTemplate transactions;
    private final Clock clock;

    ReceiptInvoiceService(StockStore db, StockService stock, OperationsAccess access, CatalogPersistence audit,
        PrivateObjectStorage storage, ReceiptInvoiceImageValidator validator, PlatformTransactionManager manager, Clock clock) {
        this.db = db;
        this.stock = stock;
        this.access = access;
        this.audit = audit;
        this.storage = storage;
        this.validator = validator;
        this.transactions = new TransactionTemplate(manager);
        this.clock = clock;
    }

    public Listing list(long documentId, long branchId, boolean history) {
        authorize(documentId, branchId, PermissionCodes.INVENTORY_INVOICE_READ);
        if (history) stock.require(PermissionCodes.INVENTORY_AUDIT_READ);
        var files = db.jdbc().query("SELECT * FROM " + TABLE
            + " WHERE document_id=? AND branch_id=?"
            + (history ? " AND status IN ('REPLACED','DELETED')" : " AND status='ACTIVE'")
            + " ORDER BY uploaded_at,id",
            (rs, index) -> row(rs).metadata(), documentId, branchId);
        return new Listing(storage.ready(), files);
    }

    public Download open(long documentId, long branchId, UUID id) {
        authorize(documentId, branchId, PermissionCodes.INVENTORY_INVOICE_READ);
        Row row = get(documentId, branchId, id, false);
        if (row.status().equals("PENDING")) throw OperationsAccess.missing();
        if (!row.status().equals("ACTIVE")) stock.require(PermissionCodes.INVENTORY_AUDIT_READ);
        return new Download(row.metadata(), storage.open(row.objectKey()));
    }

    public Metadata upload(long documentId, long branchId, UUID replaces, UUID command, MultipartFile file) {
        authorize(documentId, branchId, PermissionCodes.INVENTORY_INVOICE_UPLOAD);
        if (!storage.ready()) throw R2ObjectStorage.notConfigured();
        var image = validator.validate(file);
        long actor = access.actor();

        // Commit the reservation before I/O so a failed or interrupted PUT can always be reconciled.
        Row reserved = Objects.requireNonNull(transactions.execute(tx ->
            reserve(documentId, branchId, replaces, command, actor, image)));
        return Objects.requireNonNull(transactions.execute(tx -> {
            Row pending = get(documentId, branchId, UUID.fromString(reserved.metadata().id()), true);
            if (!pending.status().equals("PENDING")) return pending.metadata();
            storage.put(pending.objectKey(), image.bytes(), image.contentType());
            lockWritableReceipt(documentId, branchId);
            if (replaces != null) {
                var prior = get(documentId, branchId, replaces, true);
                if (!prior.status().equals("ACTIVE")) throw conflict("This image was already changed.");
                changeStatus(prior.metadata().id(), "REPLACED");
            }
            changeStatus(pending.metadata().id(), "ACTIVE");
            audit.audit(branchId, "inventory", "receipt_invoices", documentId,
                replaces == null ? "UPLOADED" : "REPLACED", auditDetails(pending.metadata()));
            var metadata = pending.metadata();
            return new Metadata(metadata.id(), metadata.originalName(), metadata.contentType(), metadata.byteSize(),
                metadata.checksum(), metadata.uploadedBy(), metadata.uploadedAt(), metadata.version(), "ACTIVE");
        }));
    }

    public void remove(long documentId, long branchId, UUID id) {
        authorize(documentId, branchId, PermissionCodes.INVENTORY_INVOICE_DELETE);
        transactions.executeWithoutResult(tx -> {
            lockWritableReceipt(documentId, branchId);
            // Pending uploads lock their own row before the receipt. Never wait on those rows here.
            if (get(documentId, branchId, id, false).status().equals("PENDING")) throw OperationsAccess.missing();
            Row row = get(documentId, branchId, id, true);
            if (row.status().equals("DELETED")) return;
            if (!row.status().equals("ACTIVE")) throw conflict("This image was already changed.");
            changeStatus(row.metadata().id(), "DELETED");
            audit.audit(branchId, "inventory", "receipt_invoices", documentId, "REMOVED", auditDetails(row.metadata()));
        });
    }

    private Row reserve(long documentId, long branchId, UUID replaces, UUID command, long actor,
        ReceiptInvoiceImageValidator.Image image) {
        var receipt = db.one("SELECT status FROM stock_documents WHERE id=? AND branch_id=? FOR UPDATE", documentId, branchId);
        var previous = db.jdbc().query("SELECT * FROM " + TABLE
            + " WHERE document_id=? AND branch_id=? AND uploaded_by=? AND command_id=?",
            (rs, index) -> row(rs), documentId, branchId, actor, command.toString());
        if (!previous.isEmpty()) {
            Row row = previous.get(0);
            if (!image.checksum().equals(row.metadata().checksum()) || !image.filename().equals(row.metadata().originalName())
                || !Objects.equals(replaces == null ? null : replaces.toString(), row.replacesId())) {
                throw conflict("Use a new operation key for a different image or target.");
            }
            return row;
        }
        requireWritable(receipt);
        Row prior = replaces == null ? null : get(documentId, branchId, replaces, false);
        if (prior != null && !prior.status().equals("ACTIVE")) {
            throw conflict("This image was already changed.");
        }
        long version = prior == null ? 1 : prior.metadata().version() + 1;
        UUID id = UUID.randomUUID();
        Instant now = clock.instant();
        String objectKey = "branches/" + branchId + "/inventory/receipts/" + DIRECTORY.format(now) + "/" + id + image.extension();
        db.jdbc().update("INSERT INTO " + TABLE
            + " (id,branch_id,document_id,object_key,original_name,content_type,byte_size,checksum,uploaded_by,uploaded_at,"
            + "status,version,replaces_id,command_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            id.toString(), branchId, documentId, objectKey, image.filename(), image.contentType(), image.bytes().length,
            image.checksum(), actor, StockStore.time(now), "PENDING", version,
            replaces == null ? null : replaces.toString(), command.toString());
        return get(documentId, branchId, id, false);
    }

    private void authorize(long documentId, long branchId, String permission) {
        stock.require(PermissionCodes.INVENTORY_DOCUMENT_READ);
        // Invoice pixels can disclose prices even where the receipt JSON has been redacted.
        stock.require(PermissionCodes.INVENTORY_COST_READ);
        stock.require(permission);
        var document = stock.document(documentId, branchId);
        if (!"RECEIPT".equals(document.get("kind")) || StockStore.id(document, "branchId") != branchId) {
            throw OperationsAccess.missing();
        }
    }

    private void lockWritableReceipt(long documentId, long branchId) {
        requireWritable(db.one("SELECT status FROM stock_documents WHERE id=? AND branch_id=? FOR UPDATE", documentId, branchId));
    }

    private void requireWritable(Map<String, Object> receipt) {
        if ("CANCELLED".equals(receipt.get("status"))) throw conflict("A cancelled receipt cannot change its images.");
    }

    private Row get(long documentId, long branchId, UUID id, boolean lock) {
        var rows = db.jdbc().query("SELECT * FROM " + TABLE + " WHERE id=? AND document_id=? AND branch_id=?"
            + (lock ? " FOR UPDATE" : ""), (rs, index) -> row(rs), id.toString(), documentId, branchId);
        if (rows.isEmpty()) throw OperationsAccess.missing();
        return rows.get(0);
    }

    private Row row(ResultSet rs) throws SQLException {
        var metadata = new Metadata(rs.getString("id"), rs.getString("original_name"),
            rs.getString("content_type"), rs.getLong("byte_size"), rs.getString("checksum"),
            rs.getLong("uploaded_by"), rs.getTimestamp("uploaded_at").toInstant(), rs.getLong("version"), rs.getString("status"));
        return new Row(metadata, rs.getString("object_key"), rs.getString("status"), rs.getString("replaces_id"));
    }

    private void changeStatus(String id, String status) {
        db.jdbc().update("UPDATE " + TABLE + " SET status=? WHERE id=?", status, id);
    }

    private String auditDetails(Metadata metadata) {
        return "image:" + metadata.id() + ",version:" + metadata.version();
    }

    @Scheduled(fixedDelayString = "${app.r2.cleanup-delay-ms:3600000}", initialDelayString = "${app.r2.cleanup-delay-ms:3600000}")
    void cleanupPending() {
        if (!storage.ready()) return;
        var cutoff = StockStore.time(clock.instant().minus(Duration.ofDays(1)));
        var ids = db.jdbc().queryForList("SELECT id FROM " + TABLE
            + " WHERE status='PENDING' AND uploaded_at<? ORDER BY uploaded_at LIMIT 50", String.class, cutoff);
        for (String id : ids) {
            try {
                transactions.executeWithoutResult(tx -> {
                    var keys = db.jdbc().queryForList("SELECT object_key FROM " + TABLE
                        + " WHERE id=? AND status='PENDING' AND uploaded_at<? FOR UPDATE", String.class, id, cutoff);
                    if (keys.isEmpty()) return;
                    storage.delete(keys.get(0));
                    db.jdbc().update("DELETE FROM " + TABLE + " WHERE id=?", id);
                });
            } catch (RuntimeException exception) {
                LOG.warn("Could not clean pending invoice image {}", id);
            }
        }
    }

    private static ApiException conflict(String detail) {
        return new ApiException(HttpStatus.CONFLICT, ErrorCode.INVENTORY_INVOICE_CONFLICT, "Invoice image changed", detail);
    }

    public record Metadata(String id, String originalName, String contentType, long byteSize, String checksum,
        long uploadedBy, Instant uploadedAt, long version, String status) {}
    public record Listing(boolean storageReady, List<Metadata> files) {}
    public record Download(Metadata metadata, InputStream stream) {}
    private record Row(Metadata metadata, String objectKey, String status, String replacesId) {}
}
