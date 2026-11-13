package com.laundry.management.inventory.operations;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.RoleRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.storage.PrivateObjectStorage;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ReceiptInvoiceIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired StockStore db;
    @Autowired BranchRepository branches;
    @Autowired UserAccountRepository users;
    @Autowired RoleRepository roles;
    @Autowired PasswordEncoder passwords;
    @Autowired ReceiptInvoiceService invoices;
    @MockitoBean PrivateObjectStorage storage;
    private long branch;
    private long receipt;
    private long warehouse;
    private long actor;
    private String token;
    private String base;
    private byte[] png;

    @BeforeEach
    void seed() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        var b = branches.saveAndFlush(new Branch("I" + suffix, "Invoice test"));
        branch = b.getId();
        var manager = user(b, "manager" + suffix, "MANAGER");
        actor = manager.getId();
        token = login(manager.getUsername());
        warehouse = db.insert("INSERT INTO warehouses(branch_id,code,name,active,created_at,updated_at,created_by,updated_by)"
            + " VALUES (?,?,?,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,?)", branch, suffix, "Main", actor, actor);
        receipt = document(branch, warehouse, actor);
        base = "/api/inventory/documents/" + receipt + "/invoice-images";
        try (var bytes = new ByteArrayOutputStream()) {
            ImageIO.write(new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB), "png", bytes);
            png = bytes.toByteArray();
        }
        when(storage.ready()).thenReturn(true);
        when(storage.open(anyString())).thenAnswer(call -> new ByteArrayInputStream(png));
    }

    @Test
    void persistsMetadataAndStreamsPrivateContentAndReplaysAnUpload() throws Exception {
        UUID key = UUID.randomUUID();
        String id = upload(base, key);
        assertEquals(id, upload(base, key));
        verify(storage, times(1)).put(matches("branches/" + branch + "/inventory/receipts/\\d{4}/\\d{2}/" + id + "\\.png"),
            aryBytes(), eq("image/png"));
        mvc.perform(auth(get(base))).andExpect(status().isOk()).andExpect(jsonPath("$.files.length()").value(1))
            .andExpect(jsonPath("$.files[0].checksum").isString()).andExpect(jsonPath("$.files[0].objectKey").doesNotExist());
        mvc.perform(auth(get(base + "/" + id + "/content"))).andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "private, no-store"))
            .andExpect(content().contentType("image/png")).andExpect(content().bytes(png));
        assertEquals("ACTIVE", db.jdbc().queryForObject(
            "SELECT status FROM inventory_receipt_invoices WHERE id=?", String.class, id));
    }

    @Test
    void rejectsOversizedInvalidAndMisdeclaredImagesBeforeStorage() throws Exception {
        for (var file : new MockMultipartFile[]{
            new MockMultipartFile("file", "wrong.png", "image/png", new byte[]{1, 2, 3}),
            new MockMultipartFile("file", "wrong.jpg", "image/jpeg", png),
            new MockMultipartFile("file", "broken.png", "image/png", java.util.Arrays.copyOf(png, 28))
        }) {
            mvc.perform(auth(multipart(base).file(file).header("Idempotency-Key", UUID.randomUUID())))
                .andExpect(status().isUnsupportedMediaType());
        }
        var big = new MockMultipartFile("file", "large.png", "image/png", new byte[10 * 1024 * 1024 + 1]);
        mvc.perform(auth(multipart(base).file(big).header("Idempotency-Key", UUID.randomUUID())))
            .andExpect(status().isPayloadTooLarge());
        verify(storage, never()).put(anyString(), any(), anyString());
    }

    @Test
    void acceptsDecodedJpegAndWebp() throws Exception {
        var jpeg = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB), "jpeg", jpeg);
        byte[] webp = java.util.Base64.getDecoder().decode("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==");
        for (var image : new MockMultipartFile[]{
            new MockMultipartFile("file", "synthetic.jpg", "image/jpeg", jpeg.toByteArray()),
            new MockMultipartFile("file", "synthetic.webp", "image/webp", webp)
        }) {
            mvc.perform(auth(multipart(base).file(image).header("Idempotency-Key", UUID.randomUUID())))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.contentType").value(image.getContentType()));
        }
    }

    @Test
    void enforcesPermissionAndBranchEvenForKnownImageIds() throws Exception {
        String id = upload(base, UUID.randomUUID());
        long sameBranchReader = user(branches.findById(branch).orElseThrow(), "reader" + receipt, "RECEPTIONIST").getId();
        db.jdbc().update("INSERT INTO user_permission_overrides(user_id,permission_id,effect,reason)"
            + " SELECT ?,id,'ALLOW','Invoice test' FROM permissions WHERE code IN"
            + " ('inventory.document.read','inventory.invoice.read','inventory.cost.read')", sameBranchReader);
        var reader = users.findById(sameBranchReader).orElseThrow();
        String readerToken = login(reader.getUsername());
        mvc.perform(scoped(get(base + "/" + id + "/content"), branch, readerToken)).andExpect(status().isOk());
        mvc.perform(scoped(delete(base + "/" + id), branch, readerToken)).andExpect(status().isForbidden());
        db.jdbc().update("INSERT INTO user_permission_overrides(user_id,permission_id,effect,reason)"
            + " SELECT ?,id,'DENY','Cost hidden' FROM permissions WHERE code='inventory.cost.read'", actor);
        mvc.perform(auth(get(base + "/" + id + "/content"))).andExpect(status().isForbidden());
        var other = branches.saveAndFlush(new Branch("OTHER" + receipt, "Other"));
        var outsider = user(other, "outsider" + receipt, "ADMIN");
        mvc.perform(scoped(get(base + "/" + id + "/content"), other.getId(), login(outsider.getUsername())))
            .andExpect(status().isNotFound());
        mvc.perform(scoped(get(base + "/" + id + "/content"), branch, login(outsider.getUsername())))
            .andExpect(status().isForbidden());
        String anotherReceipt = "/api/inventory/documents/" + document(branch, warehouse, actor) + "/invoice-images";
        mvc.perform(scoped(get(anotherReceipt + "/" + id + "/content"), branch, readerToken))
            .andExpect(status().isNotFound());
    }

    @Test
    void replacesAndSoftDeletesWithAuditableVersions() throws Exception {
        String first = upload(base, UUID.randomUUID());
        String second = upload(base + "/" + first + "/replace", UUID.randomUUID());
        assertNotEquals(first, second);
        mvc.perform(auth(get(base))).andExpect(jsonPath("$.files[0].id").value(second))
            .andExpect(jsonPath("$.files[0].version").value(2));
        mvc.perform(auth(delete(base + "/" + second))).andExpect(status().isNoContent());
        mvc.perform(auth(delete(base + "/" + second))).andExpect(status().isNoContent());
        mvc.perform(auth(get(base))).andExpect(jsonPath("$.files.length()").value(0));
        mvc.perform(auth(get(base).param("history", "true"))).andExpect(jsonPath("$.files.length()").value(2));
        mvc.perform(auth(get(base + "/" + first + "/content"))).andExpect(status().isOk());
        assertEquals(3, db.jdbc().queryForObject(
            "SELECT COUNT(*) FROM operations_audit WHERE resource='receipt_invoices' AND record_id=?", Integer.class, receipt));
        verify(storage, never()).delete(anyString());
    }

    @Test
    void retriesWithTheSameObjectAfterStorageFailureAndCleansAbandonedPendingRows() throws Exception {
        doThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.INVENTORY_INVOICE_STORAGE_UNAVAILABLE,
            "Unavailable", "Retry")).doNothing().when(storage).put(anyString(), any(), anyString());
        UUID key = UUID.randomUUID();
        mvc.perform(auth(multipart(base).file(image()).header("Idempotency-Key", key)))
            .andExpect(status().isServiceUnavailable());
        mvc.perform(auth(get(base))).andExpect(jsonPath("$.files.length()").value(0));
        String id = upload(base, key);
        assertEquals(id, upload(base, key));
        var keyCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(storage, times(2)).put(keyCaptor.capture(), any(), anyString());
        assertEquals(keyCaptor.getAllValues().get(0), keyCaptor.getAllValues().get(1));
        doThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.INVENTORY_INVOICE_STORAGE_UNAVAILABLE,
            "Unavailable", "Retry")).when(storage).put(anyString(), any(), anyString());
        mvc.perform(auth(multipart(base).file(image()).header("Idempotency-Key", UUID.randomUUID())))
            .andExpect(status().isServiceUnavailable());
        String orphan = db.jdbc().queryForObject("SELECT object_key FROM inventory_receipt_invoices WHERE document_id=?"
            + " AND status='PENDING'", String.class, receipt);
        db.jdbc().update("UPDATE inventory_receipt_invoices SET uploaded_at=? WHERE object_key=?",
            StockStore.time(Instant.now().minusSeconds(172800)), orphan);
        invoices.cleanupPending();
        verify(storage).delete(orphan);
        assertEquals(0, db.jdbc().queryForObject("SELECT COUNT(*) FROM inventory_receipt_invoices WHERE object_key=?",
            Integer.class, orphan));
    }

    @Test
    void cancelledReceiptRetainsItsImageAndDisabledStorageIsExplicit() throws Exception {
        String id = upload(base, UUID.randomUUID());
        db.jdbc().update("UPDATE stock_documents SET status='CANCELLED' WHERE id=?", receipt);
        mvc.perform(auth(get(base + "/" + id + "/content"))).andExpect(status().isOk());
        mvc.perform(auth(delete(base + "/" + id))).andExpect(status().isConflict());
        when(storage.ready()).thenReturn(false);
        mvc.perform(auth(get(base))).andExpect(jsonPath("$.storageReady").value(false));
        mvc.perform(auth(multipart(base).file(image()).header("Idempotency-Key", UUID.randomUUID())))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.errorCode").value("INVENTORY_INVOICE_STORAGE_NOT_CONFIGURED"));
    }

    private long document(long branchId, long warehouseId, long userId) {
        return db.insert("INSERT INTO stock_documents(branch_id,code,kind,status,warehouse_id,business_at,created_at,updated_at,"
            + "created_by,updated_by,current_snapshot) VALUES (?,?,'RECEIPT','RECORDED',?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,"
            + "CURRENT_TIMESTAMP,?,?,?)", branchId, UUID.randomUUID().toString(), warehouseId, userId, userId, "{}");
    }

    private UserAccount user(Branch branch, String name, String role) {
        var account = new UserAccount(name, passwords.encode("invoice-test-only"), name, branch);
        account.addRole(roles.findByCode(role).orElseThrow());
        account = users.saveAndFlush(account);
        account.assignBranch(branch, true);
        return users.saveAndFlush(account);
    }

    private String login(String name) throws Exception {
        var request = json.createObjectNode().put("username", name).put("password", "invoice-test-only");
        return json.readTree(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(request.toString())).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray())
            .path("accessToken").asText();
    }

    private MockMultipartFile image() {
        return new MockMultipartFile("file", "test-invoice.png", "image/png", png);
    }

    private String upload(String path, UUID key) throws Exception {
        return json.readTree(mvc.perform(auth(multipart(path).file(image()).header("Idempotency-Key", key)))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsByteArray()).path("id").asText();
    }

    private byte[] aryBytes() {
        return org.mockito.AdditionalMatchers.aryEq(png);
    }

    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request) {
        return scoped(request, branch, token);
    }

    private MockHttpServletRequestBuilder scoped(MockHttpServletRequestBuilder request, long scope, String accessToken) {
        return request.param("branchId", Long.toString(scope)).header("Authorization", "Bearer " + accessToken);
    }
}
