package com.laundry.management.order;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.Role;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.domain.PermissionOverrideEffect;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.RoleRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.auth.infrastructure.PermissionRepository;
import com.laundry.management.notification.infrastructure.NotificationRepository;
import com.laundry.management.notification.infrastructure.NotificationRecipientRepository;
import com.laundry.management.order.infrastructure.BranchOrderSequenceRepository;
import com.laundry.management.order.infrastructure.OrderHistoryRepository;
import com.laundry.management.order.infrastructure.OrderRepository;
import com.laundry.management.servicecatalog.infrastructure.ItemTypeRepository;
import com.laundry.management.servicecatalog.infrastructure.LaundryServiceRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceListRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceRuleRepository;
import com.laundry.management.servicecatalog.infrastructure.PricingAuditRepository;
import com.laundry.management.servicecatalog.infrastructure.ServiceItemEligibilityRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class OrderIntegrationTest {
    private static final String PASSWORD = "order-integration-password";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired UserAccountRepository users;
    @Autowired BranchRepository branches;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired OrderRepository orders;
    @Autowired OrderHistoryRepository orderHistory;
    @Autowired BranchOrderSequenceRepository orderSequences;
    @Autowired NotificationRepository notifications;
    @Autowired NotificationRecipientRepository notificationRecipients;
    @Autowired PricingAuditRepository pricingAudit;
    @Autowired PriceRuleRepository priceRules;
    @Autowired PriceListRepository priceLists;
    @Autowired ServiceItemEligibilityRepository eligibility;
    @Autowired ItemTypeRepository itemTypes;
    @Autowired LaundryServiceRepository services;

    private Branch branchA;
    private Branch branchB;
    private String managerA;
    private String managerB;
    private String receptionistA;
    private JsonNode service;
    private long itemTypeId;

    @BeforeEach
    void setUp() throws Exception {
        String run = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        branchA = branches.save(new Branch("OA" + run, "Order branch A " + run));
        branchB = branches.save(new Branch("OB" + run, "Order branch B " + run));
        String hash = passwordEncoder.encode(PASSWORD);
        String managerAName = "order.manager.a." + run.toLowerCase();
        String managerBName = "order.manager.b." + run.toLowerCase();
        String receptionistName = "order.reception.a." + run.toLowerCase();
        createAccount(managerAName, "Order Manager A", hash, branchA, "MANAGER");
        createAccount(managerBName, "Order Manager B", hash, branchB, "MANAGER");
        UserAccount receptionist = createAccount(receptionistName, "Order Reception A", hash, branchA, "RECEPTIONIST");
        for (String code : java.util.List.of("pricing.preview","service.read","item-type.read","customer.read")) {
            receptionist.overridePermission(permissions.findByCode(code).orElseThrow(), PermissionOverrideEffect.DENY);
        }
        users.saveAndFlush(receptionist);
        managerA = login(managerAName);
        managerB = login(managerBName);
        receptionistA = login(receptionistName);
        service = createService();
        itemTypeId = createAndAssignItemType(service.path("id").asLong());
        JsonNode priceList = createPriceList();
        addWeightRule(priceList.path("id").asLong(), service.path("id").asLong(), priceList.path("effectiveFrom").asText());
        publish(priceList);
    }

    @AfterEach
    void cleanModuleFixtures() {
        notificationRecipients.deleteAll();
        notifications.deleteAll();
        orderHistory.deleteAll();
        orders.deleteAll();
        orderSequences.deleteAll();
        pricingAudit.deleteAll();
        priceRules.deleteAll();
        priceLists.deleteAll();
        eligibility.deleteAll();
        itemTypes.deleteAll();
        services.deleteAll();
    }

    @Test
    void createsGuestOrderWithAuthoritativeTotalImmutableSnapshotAndNullablePromise() throws Exception {
        long before = orders.count();
        JsonNode created = createGuestOrder(managerA, item(2), item(3));
        long id = created.path("id").asLong();

        org.assertj.core.api.Assertions.assertThat(orders.count()).isEqualTo(before + 1);
        org.assertj.core.api.Assertions.assertThat(created.path("customerId").isNull()).isTrue();
        org.assertj.core.api.Assertions.assertThat(created.path("promisedAt").isNull()).isTrue();
        org.assertj.core.api.Assertions.assertThat(created.path("totalAmount").decimalValue()).isEqualByComparingTo("125000");
        org.assertj.core.api.Assertions.assertThat(created.path("items").get(0).path("pricingSnapshot").path("finalAmount").decimalValue()).isEqualByComparingTo("50000");

        ObjectNode rename = serviceRequest("Tên dịch vụ hiện tại đã đổi");
        rename.put("version", service.path("version").asLong());
        mockMvc.perform(put("/api/services/{id}", service.path("id").asLong())
                .header("Authorization", bearer(managerA)).contentType(MediaType.APPLICATION_JSON).content(rename.toString()))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/orders/{id}", id).header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.orderCode", matchesPattern(branchA.getCode() + "-DH-\\d{6}")))
            .andExpect(jsonPath("$.customerName").value("Khách vãng lai kiểm thử"))
            .andExpect(jsonPath("$.customerPhone").value("0909 000 123"))
            .andExpect(jsonPath("$.items", hasSize(2)))
            .andExpect(jsonPath("$.items[0].serviceName").value("Giặt sấy kiểm thử"));
    }

    @Test
    void enforcesTransitionPolicyReasonsAndCurrentTransitionMetadata() throws Exception {
        JsonNode order = createGuestOrder(managerA, item(2));
        order = command(managerA, order, "start-processing", null, 200);
        command(managerA, order, "complete", null, 422);
        order = command(managerA, order, "mark-ready", null, 200);
        JsonNode cancelled = command(managerA, order, "cancel", "Khách đổi kế hoạch", 200);
        org.assertj.core.api.Assertions.assertThat(cancelled.path("cancelledAt").asText()).isNotBlank();
        org.assertj.core.api.Assertions.assertThat(cancelled.path("cancelledBy").path("displayName").asText()).isEqualTo("Order Manager A");
        org.assertj.core.api.Assertions.assertThat(cancelled.path("cancelReason").asText()).isEqualTo("Khách đổi kế hoạch");
        command(managerA, cancelled, "reopen", "Không hợp lệ", 422);

        JsonNode completed = createGuestOrder(managerA, item(1));
        completed = command(managerA, completed, "start-processing", null, 200);
        completed = command(managerA, completed, "mark-ready", null, 200);
        completed = command(managerA, completed, "complete", null, 200);
        JsonNode reopened = command(managerA, completed, "reopen", "Trả lại để xử lý bổ sung", 200);
        org.assertj.core.api.Assertions.assertThat(reopened.path("status").asText()).isEqualTo("REOPENED");
        org.assertj.core.api.Assertions.assertThat(reopened.path("reopenedAt").asText()).isNotBlank();
        org.assertj.core.api.Assertions.assertThat(reopened.path("reopenReason").asText()).isEqualTo("Trả lại để xử lý bổ sung");
    }

    @Test
    void enforcesPermissionBranchScopeAndOptimisticVersion() throws Exception {
        JsonNode order = createGuestOrder(receptionistA, item(2));
        long id = order.path("id").asLong();

        mockMvc.perform(get("/api/orders/{id}", id).header("Authorization", bearer(managerB)).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.errorCode").value("BRANCH_ACCESS_DENIED"));
        mockMvc.perform(post("/api/orders/{id}/cancel", id).header("Authorization", bearer(receptionistA))
                .header("X-Branch-Id", branchA.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":" + order.path("version").asLong() + ",\"reason\":\"Không có quyền\"}"))
            .andExpect(status().isForbidden());

        JsonNode processing = command(managerA, order, "start-processing", null, 200);
        ObjectNode stale = objectMapper.createObjectNode();
        stale.put("version", order.path("version").asLong());
        stale.put("note", "Ghi đè bằng phiên bản cũ");
        mockMvc.perform(patch("/api/orders/{id}", id).header("Authorization", bearer(managerA))
                .header("X-Branch-Id", branchA.getId()).contentType(MediaType.APPLICATION_JSON).content(stale.toString()))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("ORDER_VERSION_CONFLICT"));
        org.assertj.core.api.Assertions.assertThat(processing.path("version").asLong()).isGreaterThan(order.path("version").asLong());
    }

    @Test
    void repricesStructuralEditsOnlyWhileReceivedAndAllowsSafeMetadataLater() throws Exception {
        JsonNode order = createGuestOrder(managerA, item(2));
        ObjectNode update = objectMapper.createObjectNode();
        update.put("version", order.path("version").asLong());
        update.put("note", "Đã cân lại");
        update.putArray("items").add(item(3));
        MvcResult updatedResult = mockMvc.perform(patch("/api/orders/{id}", order.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content(update.toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalAmount").value(75000.0)).andReturn();
        JsonNode updated = body(updatedResult);

        JsonNode processing = command(managerA, updated, "start-processing", null, 200);
        update.put("version", processing.path("version").asLong());
        mockMvc.perform(patch("/api/orders/{id}", order.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content(update.toString()))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.errorCode").value("ORDER_IMMUTABLE"));

        ObjectNode metadata = objectMapper.createObjectNode();
        metadata.put("version", processing.path("version").asLong());
        metadata.put("note", "Ghi chú vận hành an toàn");
        mockMvc.perform(patch("/api/orders/{id}", order.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content(metadata.toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.note").value("Ghi chú vận hành an toàn"));
        mockMvc.perform(get("/api/orders/{id}/history", order.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isOk()).andExpect(jsonPath("$[*].action", org.hamcrest.Matchers.hasItem("UPDATED")));
    }

    @Test
    void requiresConcreteItemTypeAndPreservesOmittedPatchFields() throws Exception {
        ObjectNode missingType = item(2);
        missingType.remove("itemTypeId");
        createGuestOrderExpecting(managerA, 400, missingType);

        ObjectNode create = objectMapper.createObjectNode();
        create.put("branchId", branchA.getId()); create.put("guestName", "Khách patch");
        create.put("promisedAt", "2026-09-20T10:00:00Z"); create.put("note", "Ghi chú ban đầu");
        create.putArray("items").add(item(2));
        JsonNode order = body(mockMvc.perform(post("/api/orders").header("Authorization", bearer(managerA))
                .contentType(MediaType.APPLICATION_JSON).content(create.toString()))
            .andExpect(status().isCreated()).andReturn());

        ObjectNode noteOnly = objectMapper.createObjectNode();
        noteOnly.put("version", order.path("version").asLong()); noteOnly.put("note", "Chỉ đổi ghi chú");
        order = body(mockMvc.perform(patch("/api/orders/{id}", order.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content(noteOnly.toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.promisedAt").value("2026-09-20T10:00:00Z"))
            .andExpect(jsonPath("$.note").value("Chỉ đổi ghi chú")).andReturn());

        ObjectNode promiseOnly = objectMapper.createObjectNode();
        promiseOnly.put("version", order.path("version").asLong()); promiseOnly.put("promisedAt", "2026-09-21T10:00:00Z");
        order = body(mockMvc.perform(patch("/api/orders/{id}", order.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content(promiseOnly.toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.note").value("Chỉ đổi ghi chú"))
            .andExpect(jsonPath("$.items", hasSize(1))).andReturn());

        ObjectNode clearPromise = objectMapper.createObjectNode();
        clearPromise.put("version", order.path("version").asLong()); clearPromise.putNull("promisedAt");
        mockMvc.perform(patch("/api/orders/{id}", order.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content(clearPromise.toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.promisedAt").isEmpty())
            .andExpect(jsonPath("$.note").value("Chỉ đổi ghi chú"));
    }

    @Test
    void orderCreatePermissionProvidesOnlyMinimalIntakeAndTrustedQuote() throws Exception {
        mockMvc.perform(get("/api/services").header("Authorization", bearer(receptionistA)))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/orders/intake/services").param("branchId", branchA.getId().toString())
                .header("Authorization", bearer(receptionistA)))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(service.path("id").asLong()))
            .andExpect(jsonPath("$[0].descriptionVi").doesNotExist());
        mockMvc.perform(get("/api/orders/intake/services/{id}/items", service.path("id").asLong())
                .param("branchId", branchA.getId().toString()).header("Authorization", bearer(receptionistA)))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(itemTypeId));

        ObjectNode quote = item(2); quote.put("branchId", branchA.getId());
        mockMvc.perform(post("/api/orders/intake/quote").header("Authorization", bearer(receptionistA))
                .contentType(MediaType.APPLICATION_JSON).content(quote.toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.currency").value("VND"))
            .andExpect(jsonPath("$.finalAmount").value(50000.0));
        mockMvc.perform(get("/api/orders/intake/services").param("branchId", branchB.getId().toString())
                .header("Authorization", bearer(receptionistA)))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.errorCode").value("BRANCH_ACCESS_DENIED"));

        JsonNode created = createGuestOrder(receptionistA, item(2));
        org.assertj.core.api.Assertions.assertThat(created.path("currency").asText()).isEqualTo("VND");
    }

    @Test
    void intakeRejectsParentAndInactiveItemTypesAndSupportsPhoneSuffixSearch() throws Exception {
        JsonNode parent = createItemTypeResponse("Nhóm đồ tổ chức", null);
        createItemTypeResponse("Loại đồ con", parent.path("id").asLong());
        ObjectNode parentQuote = item(1);
        parentQuote.put("branchId", branchA.getId());
        parentQuote.put("itemTypeId", parent.path("id").asLong());
        mockMvc.perform(post("/api/orders/intake/quote").header("Authorization", bearer(receptionistA))
                .contentType(MediaType.APPLICATION_JSON).content(parentQuote.toString()))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.detail", org.hamcrest.Matchers.containsString("Parent item types")));

        JsonNode inactive = createItemTypeResponse("Loại đồ ngừng dùng", null);
        ObjectNode archive = objectMapper.createObjectNode();
        archive.put("status", "ARCHIVED"); archive.put("version", inactive.path("version").asLong());
        mockMvc.perform(patch("/api/item-types/{id}/status", inactive.path("id").asLong())
                .header("Authorization", bearer(managerA)).contentType(MediaType.APPLICATION_JSON)
                .content(archive.toString())).andExpect(status().isOk());
        ObjectNode inactiveQuote = item(1);
        inactiveQuote.put("branchId", branchA.getId());
        inactiveQuote.put("itemTypeId", inactive.path("id").asLong());
        mockMvc.perform(post("/api/orders/intake/quote").header("Authorization", bearer(receptionistA))
                .contentType(MediaType.APPLICATION_JSON).content(inactiveQuote.toString()))
            .andExpect(status().isUnprocessableEntity());

        ObjectNode customer = objectMapper.createObjectNode();
        customer.put("fullName", "Khách tìm bằng đuôi số"); customer.put("phone", "090 324 7812");
        customer.put("customerType", "INDIVIDUAL"); customer.put("source", "WALK_IN");
        customer.put("branchId", branchA.getId());
        mockMvc.perform(post("/api/customers").header("Authorization", bearer(receptionistA))
                .contentType(MediaType.APPLICATION_JSON).content(customer.toString()))
            .andExpect(status().isCreated());
        mockMvc.perform(get("/api/orders/intake/customers").param("query", "7812")
                .param("branchId", branchA.getId().toString()).header("Authorization", bearer(receptionistA)))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].fullName").value("Khách tìm bằng đuôi số"))
            .andExpect(jsonPath("$[0].phone").value("0903 247 812"));
    }

    @Test
    void structuralAuditContainsSafeBeforeAndAfterPricingIdentity() throws Exception {
        JsonNode order = createGuestOrder(managerA, item(2));
        ObjectNode update = objectMapper.createObjectNode(); update.put("version", order.path("version").asLong());
        update.putArray("items").add(item(4));
        mockMvc.perform(patch("/api/orders/{id}", order.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content(update.toString()))
            .andExpect(status().isOk());
        mockMvc.perform(get("/api/orders/{id}/history", order.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].changedFields.fields[0]").value("items"))
            .andExpect(jsonPath("$[0].changedFields.items.before[0].itemTypeCode").isNotEmpty())
            .andExpect(jsonPath("$[0].changedFields.items.before[0].quantity").value(2.0))
            .andExpect(jsonPath("$[0].changedFields.items.after[0].quantity").value(4.0))
            .andExpect(jsonPath("$[0].changedFields.items.after[0].lineAmount").value(100000.0));
    }

    @Test
    void rollsBackWholeCreateWhenPricingOrEligibilityFails() throws Exception {
        long before = orders.count();
        ObjectNode invalidItem = item(2);
        invalidItem.put("itemTypeId", createUnassignedItemType());
        createGuestOrderExpecting(managerA, 422, item(1), invalidItem);
        org.assertj.core.api.Assertions.assertThat(orders.count()).isEqualTo(before);
    }

    @Test
    void createsDurableNotificationOnlyForImportantEvent() throws Exception {
        long before = notifications.count();
        JsonNode order = createGuestOrder(managerA, item(1));
        org.assertj.core.api.Assertions.assertThat(notifications.count()).isEqualTo(before);
        order = command(managerA, order, "start-processing", null, 200);
        org.assertj.core.api.Assertions.assertThat(notifications.count()).isEqualTo(before);
        command(managerA, order, "mark-ready", null, 200);
        org.assertj.core.api.Assertions.assertThat(notifications.count()).isEqualTo(before + 1);
        org.assertj.core.api.Assertions.assertThat(notifications.findAll().get((int) notifications.count() - 1).getDeepLink())
            .startsWith("/orders/");
    }

    private JsonNode createGuestOrder(String token, ObjectNode... items) throws Exception {
        return createGuestOrderExpecting(token, 201, items);
    }

    private JsonNode createGuestOrderExpecting(String token, int expectedStatus, ObjectNode... items) throws Exception {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("branchId", branchA.getId());
        request.put("guestName", "Khách vãng lai kiểm thử");
        request.put("guestPhone", "0909 000 123");
        ArrayNode values = request.putArray("items");
        for (ObjectNode item : items) values.add(item);
        MvcResult result = mockMvc.perform(post("/api/orders").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(request.toString()))
            .andExpect(status().is(expectedStatus)).andReturn();
        return body(result);
    }

    private ObjectNode item(int quantity) {
        ObjectNode item = objectMapper.createObjectNode();
        item.put("serviceId", service.path("id").asLong());
        item.put("itemTypeId", itemTypeId);
        item.put("sharingMode", "ANY");
        item.put("quantity", quantity);
        return item;
    }

    private JsonNode command(String token, JsonNode order, String action, String reason, int expectedStatus) throws Exception {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("version", order.path("version").asLong());
        if (reason != null) request.put("reason", reason);
        MvcResult result = mockMvc.perform(post("/api/orders/{id}/{action}", order.path("id").asLong(), action)
                .header("Authorization", bearer(token)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content(request.toString()))
            .andExpect(status().is(expectedStatus)).andReturn();
        return body(result);
    }

    private JsonNode createService() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/services").header("Authorization", bearer(managerA))
                .contentType(MediaType.APPLICATION_JSON).content(serviceRequest("Giặt sấy kiểm thử").toString()))
            .andExpect(status().isCreated()).andReturn();
        return body(result);
    }

    private ObjectNode serviceRequest(String name) {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("nameVi", name);
        request.put("processingType", "WASH_DRY");
        request.put("defaultUnitType", "KG");
        request.put("sharingAllowed", true);
        request.put("minimumQuantity", 0);
        return request;
    }

    private long createAndAssignItemType(long serviceId) throws Exception {
        long itemId = createItemType("Quần áo kiểm thử");
        MvcResult serviceResult = mockMvc.perform(get("/api/services/{id}", serviceId).header("Authorization", bearer(managerA)))
            .andExpect(status().isOk()).andReturn();
        ObjectNode request = objectMapper.createObjectNode();
        request.put("serviceVersion", body(serviceResult).path("version").asLong());
        request.putArray("itemTypeIds").add(itemId);
        mockMvc.perform(put("/api/services/{id}/eligibility", serviceId).header("Authorization", bearer(managerA))
                .contentType(MediaType.APPLICATION_JSON).content(request.toString()))
            .andExpect(status().isOk());
        return itemId;
    }

    private long createUnassignedItemType() throws Exception { return createItemType("Đồ không tương thích " + UUID.randomUUID()); }

    private long createItemType(String name) throws Exception { return createItemTypeResponse(name, null).path("id").asLong(); }

    private JsonNode createItemTypeResponse(String name, Long parentId) throws Exception {
        ObjectNode request = objectMapper.createObjectNode();
        if (parentId != null) request.put("parentId", parentId);
        request.put("nameVi", name);
        request.put("defaultUnitType", "KG");
        request.put("requiresSeparateWash", false);
        request.put("sortOrder", 0);
        MvcResult result = mockMvc.perform(post("/api/item-types").header("Authorization", bearer(managerA))
                .contentType(MediaType.APPLICATION_JSON).content(request.toString()))
            .andExpect(status().isCreated()).andReturn();
        return body(result);
    }

    private JsonNode createPriceList() throws Exception {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("name", "Bảng giá đơn hàng " + UUID.randomUUID());
        request.put("branchId", branchA.getId());
        request.put("currency", "VND");
        request.put("effectiveFrom", Instant.now().minusSeconds(3600).toString());
        MvcResult result = mockMvc.perform(post("/api/price-lists").header("Authorization", bearer(managerA))
                .contentType(MediaType.APPLICATION_JSON).content(request.toString()))
            .andExpect(status().isCreated()).andReturn();
        return body(result);
    }

    private void addWeightRule(long listId, long serviceId, String listFrom) throws Exception {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("serviceId", serviceId);
        request.put("pricingMethod", "BY_WEIGHT");
        request.put("unitType", "KG");
        request.put("sharingMode", "ANY");
        request.put("unitPrice", 25000);
        request.put("rulePriority", 0);
        request.put("effectiveFrom", Instant.parse(listFrom).plusSeconds(1).toString());
        request.putArray("tiers");
        mockMvc.perform(post("/api/price-lists/{id}/rules", listId).header("Authorization", bearer(managerA))
                .contentType(MediaType.APPLICATION_JSON).content(request.toString()))
            .andExpect(status().isCreated());
    }

    private void publish(JsonNode list) throws Exception {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("version", list.path("version").asLong());
        request.put("reason", "Publish for order integration test");
        mockMvc.perform(post("/api/price-lists/{id}/publish", list.path("id").asLong())
                .header("Authorization", bearer(managerA)).contentType(MediaType.APPLICATION_JSON).content(request.toString()))
            .andExpect(status().isOk());
    }

    private UserAccount createAccount(String username, String displayName, String hash, Branch branch, String roleCode) {
        Role role = roles.findByCode(roleCode).orElseThrow();
        UserAccount account = new UserAccount(username, hash, displayName, branch);
        account.addRole(role);
        account = users.saveAndFlush(account);
        account.assignBranch(branch, true);
        return users.saveAndFlush(account);
    }

    private String login(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"password\":\"" + PASSWORD + "\"}"))
            .andExpect(status().isOk()).andReturn();
        return body(result).path("accessToken").asText();
    }

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private String bearer(String token) { return "Bearer " + token; }
}
