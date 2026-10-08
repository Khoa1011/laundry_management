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
import com.laundry.management.order.infrastructure.OrderBagRepository;
import com.laundry.management.order.infrastructure.OrderRepository;
import com.laundry.management.servicecatalog.infrastructure.ItemTypeRepository;
import com.laundry.management.servicecatalog.infrastructure.LaundryServiceRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceListRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceRuleRepository;
import com.laundry.management.servicecatalog.infrastructure.PricingAuditRepository;
import com.laundry.management.servicecatalog.infrastructure.ServiceItemEligibilityRepository;
import java.time.Instant;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
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
import org.springframework.jdbc.core.JdbcTemplate;

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
    @Autowired OrderBagRepository orderBags;
    @Autowired BranchOrderSequenceRepository orderSequences;
    @Autowired NotificationRepository notifications;
    @Autowired NotificationRecipientRepository notificationRecipients;
    @Autowired PricingAuditRepository pricingAudit;
    @Autowired PriceRuleRepository priceRules;
    @Autowired PriceListRepository priceLists;
    @Autowired ServiceItemEligibilityRepository eligibility;
    @Autowired JdbcTemplate jdbc;
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
        for (String code : java.util.List.of("pricing.preview","service.read","item-type.read","customer.read","order.update")) {
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
        orderBags.deleteAll();
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
    void createsServerAuthoritativeBagsInOrderAndDetailWithoutChangingPricing() throws Exception {
        JsonNode oneBag = createGuestOrder(managerA, item(2));
        ObjectNode request = objectMapper.createObjectNode();
        request.put("branchId", branchA.getId()); request.put("guestName", "Khách ba túi"); request.put("bagCount", 3);
        request.putArray("items").add(item(2));
        JsonNode created = body(mockMvc.perform(post("/api/orders").header("Authorization", bearer(managerA))
                .contentType(MediaType.APPLICATION_JSON).content(request.toString()))
            .andExpect(status().isCreated()).andReturn());
        org.assertj.core.api.Assertions.assertThat(created.path("totalAmount").decimalValue())
            .isEqualByComparingTo(oneBag.path("totalAmount").decimalValue());
        org.assertj.core.api.Assertions.assertThat(created.path("bags").size()).isEqualTo(3);
        for (int sequence = 1; sequence <= 3; sequence++) {
            JsonNode bag = created.path("bags").get(sequence - 1);
            org.assertj.core.api.Assertions.assertThat(bag.path("bagCode").asText())
                .isEqualTo(created.path("orderCode").asText() + "-" + String.format("%02d", sequence));
            org.assertj.core.api.Assertions.assertThat(bag.path("sequenceNumber").asInt()).isEqualTo(sequence);
            org.assertj.core.api.Assertions.assertThat(bag.path("status").asText()).isEqualTo("RECEIVED");
        }
        org.assertj.core.api.Assertions.assertThat(created.path("bags").get(0).path("bagCode").asText())
            .isNotEqualTo(oneBag.path("bags").get(0).path("bagCode").asText());
        mockMvc.perform(get("/api/orders/{id}", created.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.bags", hasSize(3)));
    }

    @Test
    void rejectsInvalidBagCountsBeforePersistingOrder() throws Exception {
        long before = orders.count();
        for (int count : new int[] {-1, 0, 100}) {
            ObjectNode request = objectMapper.createObjectNode();
            request.put("branchId", branchA.getId()); request.put("guestName", "Khách thử"); request.put("bagCount", count);
            request.putArray("items").add(item(1));
            mockMvc.perform(post("/api/orders").header("Authorization", bearer(managerA))
                    .contentType(MediaType.APPLICATION_JSON).content(request.toString()))
                .andExpect(status().isBadRequest());
        }
        ObjectNode invalidType = objectMapper.createObjectNode();
        invalidType.put("branchId", branchA.getId()); invalidType.put("guestName", "Khách thử"); invalidType.put("bagCount", "1.5");
        invalidType.putArray("items").add(item(1));
        mockMvc.perform(post("/api/orders").header("Authorization", bearer(managerA))
                .contentType(MediaType.APPLICATION_JSON).content(invalidType.toString()))
            .andExpect(status().isBadRequest());
        invalidType.put("bagCount", 1.5);
        mockMvc.perform(post("/api/orders").header("Authorization", bearer(managerA))
                .contentType(MediaType.APPLICATION_JSON).content(invalidType.toString()))
            .andExpect(status().isBadRequest());
        org.assertj.core.api.Assertions.assertThat(orders.count()).isEqualTo(before);
    }

    @Test
    void defaultsMissingAndNullBagCountToOneWithoutChangingExplicitOne() throws Exception {
        for (String mode : java.util.List.of("omitted", "null", "explicit")) {
            ObjectNode request = objectMapper.createObjectNode();
            request.put("branchId", branchA.getId()); request.put("guestName", "Khách cũ");
            if (mode.equals("null")) request.putNull("bagCount");
            if (mode.equals("explicit")) request.put("bagCount", 1);
            request.putArray("items").add(item(1));
            JsonNode created = body(mockMvc.perform(post("/api/orders").header("Authorization", bearer(managerA))
                    .contentType(MediaType.APPLICATION_JSON).content(request.toString()))
                .andExpect(status().isCreated()).andReturn());
            org.assertj.core.api.Assertions.assertThat(created.path("bags").size()).as(mode).isEqualTo(1);
        }
    }

    @Test
    void addsAndVoidsPhysicalBagsWithoutReusingCodesOrChangingPrice() throws Exception {
        JsonNode initial = createGuestOrder(managerA, item(2));
        long id = initial.path("id").asLong();
        String firstCode = initial.path("bags").get(0).path("bagCode").asText();
        long firstBagId = initial.path("bags").get(0).path("id").asLong();
        JsonNode second = addBag(managerA, branchA.getId(), id, 200);
        org.assertj.core.api.Assertions.assertThat(second.path("bags").size()).isEqualTo(2);
        org.assertj.core.api.Assertions.assertThat(second.path("bags").get(0).path("bagCode").asText()).isEqualTo(firstCode);
        String secondCode = second.path("bags").get(1).path("bagCode").asText();
        org.assertj.core.api.Assertions.assertThat(secondCode).isEqualTo(initial.path("orderCode").asText() + "-02");
        long secondBagId = second.path("bags").get(1).path("id").asLong();
        JsonNode voided = voidBag(managerA, branchA.getId(), id, secondBagId, "Nhập nhầm số túi", 200);
        org.assertj.core.api.Assertions.assertThat(voided.path("bags").get(1).path("status").asText()).isEqualTo("VOIDED");
        org.assertj.core.api.Assertions.assertThat(voided.path("bags").get(1).path("voidReason").asText()).isEqualTo("Nhập nhầm số túi");
        org.assertj.core.api.Assertions.assertThat(voided.path("bags").get(1).path("voidedAt").isNull()).isFalse();
        org.assertj.core.api.Assertions.assertThat(orderBags.count()).isEqualTo(2);
        JsonNode third = addBag(managerA, branchA.getId(), id, 200);
        org.assertj.core.api.Assertions.assertThat(third.path("bags").get(2).path("bagCode").asText())
            .isEqualTo(initial.path("orderCode").asText() + "-03");
        org.assertj.core.api.Assertions.assertThat(third.path("bags").get(1).path("bagCode").asText()).isEqualTo(secondCode);
        org.assertj.core.api.Assertions.assertThat(third.path("totalAmount").decimalValue())
            .isEqualByComparingTo(initial.path("totalAmount").decimalValue());
        org.assertj.core.api.Assertions.assertThat(third.path("items").get(0).path("id").asLong())
            .isEqualTo(initial.path("items").get(0).path("id").asLong());
        org.assertj.core.api.Assertions.assertThat(third.path("items").get(0).path("lineAmount").decimalValue())
            .isEqualByComparingTo(initial.path("items").get(0).path("lineAmount").decimalValue());
        voidBag(managerA, branchA.getId(), id, secondBagId, "Lần hai", 409);
        voidBag(managerA, branchA.getId(), id, firstBagId, "", 400);
        voidBag(managerA, branchA.getId(), id, firstBagId, "x".repeat(501), 400);
        mockMvc.perform(post("/api/orders/{id}/bags/{bagId}/print-requests", id, secondBagId)
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.errorCode").value("ORDER_BAG_NOT_PRINTABLE"));
        mockMvc.perform(get("/api/orders/{id}/history", id)
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.action == 'BAG_ADDED')]").isNotEmpty())
            .andExpect(jsonPath("$[?(@.action == 'BAG_VOIDED')]").isNotEmpty());
    }

    @Test
    void rejectsLastBagWrongOrderCrossBranchAndMissingUpdatePermission() throws Exception {
        JsonNode one = createGuestOrder(managerA, item(1));
        long id = one.path("id").asLong(); long bagId = one.path("bags").get(0).path("id").asLong();
        voidBag(managerA, branchA.getId(), id, bagId, "Nhập nhầm", 422);
        addBag(managerB, branchB.getId(), id, 404);
        voidBag(managerB, branchB.getId(), id, bagId, "Nhập nhầm", 404);
        addBag(receptionistA, branchA.getId(), id, 403);
        voidBag(receptionistA, branchA.getId(), id, bagId, "Nhập nhầm", 403);
        JsonNode other = createGuestOrder(managerA, item(1));
        addBag(managerA, branchA.getId(), id, 200);
        voidBag(managerA, branchA.getId(), id, other.path("bags").get(0).path("id").asLong(), "Sai đơn", 404);
    }

    @Test
    void restrictsBagMutationsToReceivedOrdersAndLeavesLegacyPlaceholderUnverified() throws Exception {
        JsonNode processing = command(managerA, createGuestOrder(managerA, item(1)), "start-processing", null, 200);
        addBag(managerA, branchA.getId(), processing.path("id").asLong(), 422);
        voidBag(managerA, branchA.getId(), processing.path("id").asLong(), processing.path("bags").get(0).path("id").asLong(), "Sai", 422);
        JsonNode ready = command(managerA, processing, "mark-ready", null, 200);
        addBag(managerA, branchA.getId(), ready.path("id").asLong(), 422);
        JsonNode completed = command(managerA, ready, "complete", null, 200);
        addBag(managerA, branchA.getId(), completed.path("id").asLong(), 422);
        JsonNode cancelled = command(managerA, createGuestOrder(managerA, item(1)), "cancel", "Khách yêu cầu", 200);
        addBag(managerA, branchA.getId(), cancelled.path("id").asLong(), 422);
        JsonNode reopened = command(managerA, completed, "reopen", "Khách quay lại", 200);
        addBag(managerA, branchA.getId(), reopened.path("id").asLong(), 422);
        JsonNode legacy = createGuestOrder(managerA, item(1));
        long legacyBagId = legacy.path("bags").get(0).path("id").asLong();
        jdbc.update("UPDATE order_bags SET status = 'LEGACY_UNVERIFIED' WHERE id = ?", legacyBagId);
        addBag(managerA, branchA.getId(), legacy.path("id").asLong(), 200);
        voidBag(managerA, branchA.getId(), legacy.path("id").asLong(), legacyBagId, "Không phải túi xác minh", 422);
        mockMvc.perform(get("/api/orders/{id}", legacy.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.bags[0].status").value("LEGACY_UNVERIFIED"));
    }

    @Test
    void concurrentAddsNeverDuplicateBagSequenceOrCode() throws Exception {
        JsonNode created = createGuestOrder(managerA, item(1));
        long id = created.path("id").asLong();
        var executor = Executors.newFixedThreadPool(2);
        var gate = new CyclicBarrier(2);
        try {
            var first = executor.submit(() -> { gate.await(); return addBag(managerA, branchA.getId(), id, 200); });
            var second = executor.submit(() -> { gate.await(); return addBag(managerA, branchA.getId(), id, 200); });
            first.get(15, TimeUnit.SECONDS);
            second.get(15, TimeUnit.SECONDS);
        } finally {
            executor.shutdownNow();
        }
        JsonNode detail = body(mockMvc.perform(get("/api/orders/{id}", id)
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isOk()).andReturn());
        org.assertj.core.api.Assertions.assertThat(detail.path("bags").size()).isEqualTo(3);
        org.assertj.core.api.Assertions.assertThat(java.util.List.of(
            detail.path("bags").get(0).path("sequenceNumber").asInt(),
            detail.path("bags").get(1).path("sequenceNumber").asInt(),
            detail.path("bags").get(2).path("sequenceNumber").asInt())).containsExactly(1, 2, 3);
        org.assertj.core.api.Assertions.assertThat(detail.path("bags").get(1).path("bagCode").asText())
            .isNotEqualTo(detail.path("bags").get(2).path("bagCode").asText());
    }

    @Test
    void rollsBackOrderWhenItsBagCodeConflicts() throws Exception {
        JsonNode first = createGuestOrder(managerA, item(1));
        String nextCode = branchA.getCode() + "-DH-000002-01";
        jdbc.update("UPDATE order_bags SET bag_code = ? WHERE id = ?", nextCode, first.path("bags").get(0).path("id").asLong());
        long orderCount = orders.count();
        long bagCount = orderBags.count();
        ObjectNode request = objectMapper.createObjectNode();
        request.put("branchId", branchA.getId()); request.put("guestName", "Khách xung đột"); request.put("bagCount", 1);
        request.putArray("items").add(item(1));
        mockMvc.perform(post("/api/orders").header("Authorization", bearer(managerA))
                .contentType(MediaType.APPLICATION_JSON).content(request.toString()))
            .andExpect(status().isConflict());
        org.assertj.core.api.Assertions.assertThat(orders.count()).isEqualTo(orderCount);
        org.assertj.core.api.Assertions.assertThat(orderBags.count()).isEqualTo(bagCount);
    }

    @Test
    void resolvesExactCustomerCodeAndRealBagCodeInsideAuthorizedBranch() throws Exception {
        ObjectNode customer = objectMapper.createObjectNode();
        customer.put("fullName", "Khách tra cứu mã"); customer.put("phone", "090 324 7812");
        customer.put("customerType", "INDIVIDUAL"); customer.put("source", "WALK_IN"); customer.put("branchId", branchA.getId());
        JsonNode createdCustomer = body(mockMvc.perform(post("/api/customers").header("Authorization", bearer(managerA))
                .contentType(MediaType.APPLICATION_JSON).content(customer.toString()))
            .andExpect(status().isCreated()).andReturn());
        String customerCode = createdCustomer.path("customerCode").asText();
        mockMvc.perform(get("/api/orders/intake/customers").param("branchId", branchA.getId().toString())
                .param("query", customerCode).header("Authorization", bearer(receptionistA)))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].customerCode").value(customerCode));
        mockMvc.perform(get("/api/orders/intake/customers").param("branchId", branchA.getId().toString())
                .param("query", "Khách tra cứu").header("Authorization", bearer(receptionistA)))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].customerCode").value(customerCode));
        mockMvc.perform(get("/api/orders/intake/scan").param("branchId", branchA.getId().toString())
                .param("code", customerCode).header("Authorization", bearer(receptionistA)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.type").value("CUSTOMER"));
        JsonNode createdOrder = createGuestOrder(managerA, item(1));
        JsonNode bag = createdOrder.path("bags").get(0);
        mockMvc.perform(get("/api/orders/intake/scan").param("branchId", branchA.getId().toString())
                .param("code", bag.path("bagCode").asText()).header("Authorization", bearer(receptionistA)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.type").value("BAG"))
            .andExpect(jsonPath("$.bagCode").value(bag.path("bagCode").asText()));
        mockMvc.perform(get("/api/orders/intake/scan").param("branchId", branchA.getId().toString())
                .param("code", "B" + bag.path("id").asLong()).header("Authorization", bearer(receptionistA)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.type").value("BAG"));
        mockMvc.perform(get("/api/orders/intake/scan").param("branchId", branchB.getId().toString())
                .param("code", bag.path("bagCode").asText()).header("Authorization", bearer(managerB)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.type").value("NOT_FOUND"));
    }

    @Test
    void auditsPrintRequestsWithoutClaimingPhysicalPrintAndEnforcesBranch() throws Exception {
        JsonNode created = createGuestOrder(managerA, item(1));
        long id = created.path("id").asLong();
        long bagId = created.path("bags").get(0).path("id").asLong();
        mockMvc.perform(post("/api/orders/{id}/bags/{bagId}/print-requests", id, bagId)
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.printRequestCount").value(1))
            .andExpect(jsonPath("$.status").value("RECEIVED"));
        mockMvc.perform(post("/api/orders/{id}/bags/{bagId}/print-requests", id, bagId)
                .header("Authorization", bearer(managerB)).header("X-Branch-Id", branchB.getId()))
            .andExpect(status().isNotFound());
        String deniedName = "order.print.denied." + UUID.randomUUID().toString().substring(0, 6);
        UserAccount denied = createAccount(deniedName, "Order print denied", passwordEncoder.encode(PASSWORD), branchA, "RECEPTIONIST");
        denied.overridePermission(permissions.findByCode("order.bag.print").orElseThrow(), PermissionOverrideEffect.DENY);
        users.saveAndFlush(denied);
        mockMvc.perform(post("/api/orders/{id}/bags/{bagId}/print-requests", id, bagId)
                .header("Authorization", bearer(login(deniedName))).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/orders/{id}/history", id)
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.action == 'LABEL_PRINT_REQUESTED')]").isNotEmpty());
    }

    @Test
    void listFiltersByServiceAndPromiseWindowWithoutRequiringCatalogPermission() throws Exception {
        JsonNode noPromise = createGuestOrder(receptionistA, item(1));
        JsonNode promised = createGuestOrder(managerA, item(1));
        ObjectNode promiseUpdate = objectMapper.createObjectNode();
        promiseUpdate.put("version", promised.path("version").asLong());
        promiseUpdate.put("promisedAt", "2030-01-15T10:00:00Z");
        patchOrder(managerA, promised, promiseUpdate, 200);

        mockMvc.perform(get("/api/orders/filter-options").param("branchId", branchA.getId().toString())
                .header("Authorization", bearer(receptionistA)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.services[0].id").value(service.path("id").asLong()));
        mockMvc.perform(get("/api/orders").param("branchId", branchA.getId().toString())
                .param("promisedMissing", "true").header("Authorization", bearer(receptionistA)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.items[0].id").value(noPromise.path("id").asLong()));
        mockMvc.perform(get("/api/orders").param("branchId", branchA.getId().toString())
                .param("promisedFrom", "2030-01-15T00:00:00Z").param("promisedTo", "2030-01-16T00:00:00Z")
                .param("serviceId", service.path("id").asText()).header("Authorization", bearer(receptionistA)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.items[0].id").value(promised.path("id").asLong()));
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
        mockMvc.perform(patch("/api/orders/{id}", id).header("Authorization", bearer(receptionistA))
                .header("X-Branch-Id", branchA.getId()).contentType(MediaType.APPLICATION_JSON)
                .content(itemNoteUpdate(order, order.path("items").get(0).path("id").asLong(), "Không có quyền").toString()))
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
    void itemNoteOnlyUpdatePreservesHistoricalPricingAfterPriceListChanges() throws Exception {
        ObjectNode originalItem = item(2);
        originalItem.put("note", "Áo trắng có vết mực ở tay áo");
        JsonNode order = createGuestOrder(managerA, originalItem);
        order = body(mockMvc.perform(get("/api/orders/{id}", order.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isOk()).andReturn());
        JsonNode beforeItem = order.path("items").get(0).deepCopy();
        JsonNode beforeSnapshot = beforeItem.path("pricingSnapshot").deepCopy();
        long notificationCount = notifications.count();

        JsonNode replacementList = createPriceList(Instant.now().minusSeconds(2));
        addWeightRule(replacementList.path("id").asLong(), service.path("id").asLong(),
            replacementList.path("effectiveFrom").asText(), 30000);
        publish(replacementList);
        ObjectNode freshQuote = item(2); freshQuote.put("branchId", branchA.getId());
        mockMvc.perform(post("/api/orders/intake/quote").header("Authorization", bearer(managerA))
                .contentType(MediaType.APPLICATION_JSON).content(freshQuote.toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.finalAmount").value(60000.0));

        ObjectNode update = objectMapper.createObjectNode();
        update.put("version", order.path("version").asLong());
        ObjectNode noteUpdate = update.putArray("itemNoteUpdates").addObject();
        noteUpdate.put("itemId", beforeItem.path("id").asLong());
        noteUpdate.put("note", "Không dùng nước xả");
        JsonNode updated = body(mockMvc.perform(patch("/api/orders/{id}", order.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content(update.toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].note").value("Không dùng nước xả"))
            .andReturn());

        JsonNode updatedItem = updated.path("items").get(0);
        org.assertj.core.api.Assertions.assertThat(updatedItem.path("pricingSnapshot")).isEqualTo(beforeSnapshot);
        org.assertj.core.api.Assertions.assertThat(updatedItem.path("quotedAt")).isEqualTo(beforeItem.path("quotedAt"));
        org.assertj.core.api.Assertions.assertThat(updatedItem.path("pricingMethod")).isEqualTo(beforeItem.path("pricingMethod"));
        org.assertj.core.api.Assertions.assertThat(updatedItem.path("unitType")).isEqualTo(beforeItem.path("unitType"));
        org.assertj.core.api.Assertions.assertThat(updatedItem.path("billableQuantity")).isEqualTo(beforeItem.path("billableQuantity"));
        org.assertj.core.api.Assertions.assertThat(updatedItem.path("lineAmount")).isEqualTo(beforeItem.path("lineAmount"));
        org.assertj.core.api.Assertions.assertThat(updated.path("totalAmount")).isEqualTo(order.path("totalAmount"));
        org.assertj.core.api.Assertions.assertThat(updated.path("currency")).isEqualTo(order.path("currency"));
        org.assertj.core.api.Assertions.assertThat(updated.path("version").asLong()).isGreaterThan(order.path("version").asLong());
        org.assertj.core.api.Assertions.assertThat(updated.path("updatedAt")).isNotEqualTo(order.path("updatedAt"));
        org.assertj.core.api.Assertions.assertThat(updated.path("updatedBy").path("displayName").asText()).isEqualTo("Order Manager A");
        org.assertj.core.api.Assertions.assertThat(notifications.count()).isEqualTo(notificationCount);

        MvcResult historyResult = mockMvc.perform(get("/api/orders/{id}/history", order.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].changedFields.fields[0]").value("itemNotes"))
            .andExpect(jsonPath("$[0].changedFields.itemNotes[0].itemId").value(beforeItem.path("id").asLong()))
            .andExpect(jsonPath("$[0].changedFields.itemNotes[0].serviceCode").isNotEmpty())
            .andExpect(jsonPath("$[0].changedFields.itemNotes[0].itemTypeCode").isNotEmpty())
            .andExpect(jsonPath("$[0].changedFields.itemNotes[0].beforeRecorded").value(true))
            .andExpect(jsonPath("$[0].changedFields.itemNotes[0].afterRecorded").value(true))
            .andReturn();
        org.assertj.core.api.Assertions.assertThat(historyResult.getResponse().getContentAsString())
            .doesNotContain("Áo trắng có vết mực ở tay áo", "Không dùng nước xả");

        ObjectNode clear = objectMapper.createObjectNode(); clear.put("version", updated.path("version").asLong());
        ObjectNode clearItem = clear.putArray("itemNoteUpdates").addObject();
        clearItem.put("itemId", beforeItem.path("id").asLong()); clearItem.putNull("note");
        JsonNode cleared = body(mockMvc.perform(patch("/api/orders/{id}", order.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content(clear.toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].note").isEmpty())
            .andReturn());
        org.assertj.core.api.Assertions.assertThat(cleared.path("items").get(0).path("pricingSnapshot"))
            .isEqualTo(beforeSnapshot);
        mockMvc.perform(get("/api/orders/{id}/history", order.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].changedFields.itemNotes[0].beforeRecorded").value(true))
            .andExpect(jsonPath("$[0].changedFields.itemNotes[0].afterRecorded").value(false));
    }

    @Test
    void rejectsAmbiguousDuplicateUnknownCrossOrderAndCrossBranchItemNoteUpdates() throws Exception {
        JsonNode first = createGuestOrder(managerA, item(1));
        JsonNode second = createGuestOrder(managerA, item(1));
        long firstItemId = first.path("items").get(0).path("id").asLong();
        long secondItemId = second.path("items").get(0).path("id").asLong();

        ObjectNode duplicate = itemNoteUpdate(first, firstItemId, "Một");
        ObjectNode duplicateEntry = duplicate.withArray("itemNoteUpdates").addObject();
        duplicateEntry.put("itemId", firstItemId); duplicateEntry.put("note", "Hai");
        patchOrder(managerA, first, duplicate, 400);

        patchOrder(managerA, first, itemNoteUpdate(first, 999999999L, "Không tồn tại"), 404);
        patchOrder(managerA, first, itemNoteUpdate(first, secondItemId, "Sai đơn"), 404);

        ObjectNode ambiguous = itemNoteUpdate(first, firstItemId, "Mơ hồ");
        ambiguous.putArray("items").add(item(2));
        patchOrder(managerA, first, ambiguous, 400);

        ObjectNode tooLong = itemNoteUpdate(first, firstItemId, "x".repeat(1001));
        patchOrder(managerA, first, tooLong, 400);

        ObjectNode nullEntry = objectMapper.createObjectNode();
        nullEntry.put("version", first.path("version").asLong());
        nullEntry.putArray("itemNoteUpdates").addNull();
        patchOrder(managerA, first, nullEntry, 400);

        mockMvc.perform(patch("/api/orders/{id}", first.path("id").asLong())
                .header("Authorization", bearer(managerB)).header("X-Branch-Id", branchB.getId())
                .contentType(MediaType.APPLICATION_JSON).content(itemNoteUpdate(first, firstItemId, "Sai chi nhánh").toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.errorCode").value("ORDER_NOT_FOUND"));
    }

    @Test
    void itemNoteUpdatesRespectStatusesAndOptimisticVersion() throws Exception {
        JsonNode received = createGuestOrder(managerA, item(1));
        long itemId = received.path("items").get(0).path("id").asLong();
        JsonNode updated = body(patchOrder(managerA, received, itemNoteUpdate(received, itemId, "Phiên bản mới"), 200));
        patchOrder(managerA, received, itemNoteUpdate(received, itemId, "Phiên bản cũ"), 409);

        JsonNode processing = command(managerA, updated, "start-processing", null, 200);
        patchOrder(managerA, processing, itemNoteUpdate(processing, itemId, "Không cho sửa"), 422);
        JsonNode ready = command(managerA, processing, "mark-ready", null, 200);
        patchOrder(managerA, ready, itemNoteUpdate(ready, itemId, "Không cho sửa"), 422);
        JsonNode completed = command(managerA, ready, "complete", null, 200);
        patchOrder(managerA, completed, itemNoteUpdate(completed, itemId, "Không cho sửa"), 422);

        JsonNode cancellable = createGuestOrder(managerA, item(1));
        JsonNode cancelled = command(managerA, cancellable, "cancel", "Khách yêu cầu", 200);
        patchOrder(managerA, cancelled, itemNoteUpdate(cancelled,
            cancelled.path("items").get(0).path("id").asLong(), "Không cho sửa"), 422);
    }

    @Test
    void requiresConcreteItemTypeAndPreservesOmittedPatchFields() throws Exception {
        ObjectNode missingType = item(2);
        missingType.remove("itemTypeId");
        createGuestOrderExpecting(managerA, 400, missingType);

        ObjectNode create = objectMapper.createObjectNode();
        create.put("branchId", branchA.getId()); create.put("guestName", "Khách patch");
        create.put("bagCount", 1);
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

    private JsonNode addBag(String token, Long branchId, long orderId, int expectedStatus) throws Exception {
        return body(mockMvc.perform(post("/api/orders/{id}/bags", orderId)
                .header("Authorization", bearer(token)).header("X-Branch-Id", branchId))
            .andExpect(status().is(expectedStatus)).andReturn());
    }

    private JsonNode voidBag(String token, Long branchId, long orderId, long bagId, String reason, int expectedStatus) throws Exception {
        return body(mockMvc.perform(post("/api/orders/{id}/bags/{bagId}/void", orderId, bagId)
                .header("Authorization", bearer(token)).header("X-Branch-Id", branchId)
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.createObjectNode().put("reason", reason).toString()))
            .andExpect(status().is(expectedStatus)).andReturn());
    }

    private JsonNode createGuestOrderExpecting(String token, int expectedStatus, ObjectNode... items) throws Exception {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("branchId", branchA.getId());
        request.put("guestName", "Khách vãng lai kiểm thử");
        request.put("guestPhone", "0909 000 123");
        request.put("bagCount", 1);
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

    private ObjectNode itemNoteUpdate(JsonNode order, long itemId, String note) {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("version", order.path("version").asLong());
        ObjectNode update = request.putArray("itemNoteUpdates").addObject();
        update.put("itemId", itemId); update.put("note", note);
        return request;
    }

    private MvcResult patchOrder(String token, JsonNode order, ObjectNode request, int expectedStatus) throws Exception {
        return mockMvc.perform(patch("/api/orders/{id}", order.path("id").asLong())
                .header("Authorization", bearer(token)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content(request.toString()))
            .andExpect(status().is(expectedStatus)).andReturn();
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
        return createPriceList(Instant.now().minusSeconds(3600));
    }

    private JsonNode createPriceList(Instant effectiveFrom) throws Exception {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("name", "Bảng giá đơn hàng " + UUID.randomUUID());
        request.put("branchId", branchA.getId());
        request.put("currency", "VND");
        request.put("effectiveFrom", effectiveFrom.toString());
        MvcResult result = mockMvc.perform(post("/api/price-lists").header("Authorization", bearer(managerA))
                .contentType(MediaType.APPLICATION_JSON).content(request.toString()))
            .andExpect(status().isCreated()).andReturn();
        return body(result);
    }

    private void addWeightRule(long listId, long serviceId, String listFrom) throws Exception {
        addWeightRule(listId, serviceId, listFrom, 25000);
    }

    private void addWeightRule(long listId, long serviceId, String listFrom, int unitPrice) throws Exception {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("serviceId", serviceId);
        request.put("pricingMethod", "BY_WEIGHT");
        request.put("unitType", "KG");
        request.put("sharingMode", "ANY");
        request.put("unitPrice", unitPrice);
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
