package com.laundry.management.washbatch;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.laundry.management.auth.domain.*;
import com.laundry.management.auth.infrastructure.*;
import com.laundry.management.order.domain.*;
import com.laundry.management.order.infrastructure.OrderRepository;
import com.laundry.management.servicecatalog.domain.*;
import com.laundry.management.servicecatalog.infrastructure.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class WashBatchIntegrationTest {
    private static final String PASSWORD = "wash-batch-password";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper json;
    @Autowired PasswordEncoder passwords;
    @Autowired BranchRepository branches;
    @Autowired RoleRepository roles;
    @Autowired UserAccountRepository users;
    @Autowired LaundryServiceRepository services;
    @Autowired ItemTypeRepository itemTypes;
    @Autowired OrderRepository orders;

    private Branch branchA;
    private Branch branchB;
    private UserAccount actorA;
    private LaundryService wash;
    private LaundryService dry;
    private ItemType shirt;
    private ItemType blanket;
    private String managerA;
    private String managerB;
    private int orderSequence;

    @BeforeEach
    void setUp() throws Exception {
        String run = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        branchA = branches.saveAndFlush(new Branch("BA" + run, "Batch branch A " + run));
        branchB = branches.saveAndFlush(new Branch("BB" + run, "Batch branch B " + run));
        actorA = account("batch.manager.a." + run.toLowerCase(), branchA);
        UserAccount actorB = account("batch.manager.b." + run.toLowerCase(), branchB);
        managerA = login(actorA.getUsername());
        managerB = login(actorB.getUsername());
        wash = services.saveAndFlush(new LaundryService("WASH" + run, "Giặt thường", "Wash", null, null,
            ProcessingType.WASH_ONLY, UnitType.KG, true, 60, BigDecimal.ONE, actorA));
        dry = services.saveAndFlush(new LaundryService("DRY" + run, "Sấy", "Dry", null, null,
            ProcessingType.DRY_ONLY, UnitType.KG, true, 40, BigDecimal.ONE, actorA));
        shirt = itemTypes.saveAndFlush(new ItemType("SHIRT" + run, null, "Áo sơ mi", "Shirt", null, null,
            UnitType.KG, false, null, null, 10, actorA));
        blanket = itemTypes.saveAndFlush(new ItemType("BLANKET" + run, null, "Chăn", "Blanket", null, null,
            UnitType.KG, false, null, null, 20, actorA));
    }

    @Test
    void candidateCreateReadyCancelAndReleasePreserveOrderStatusAndHistoryWithoutPii() throws Exception {
        LaundryOrder first = order(branchA, wash, shirt, SharingMode.SHARED_STANDARD, "Cần xử lý nhẹ", Instant.now().plusSeconds(3600));
        LaundryOrder second = order(branchA, wash, blanket, SharingMode.SHARED_PRIORITY, null, Instant.now().plusSeconds(7200));

        mockMvc.perform(get("/api/wash-batches/candidates").param("branchId", branchA.getId().toString()).header("Authorization", bearer(managerA)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items", hasSize(2)))
            .andExpect(jsonPath("$.items[0].warnings", hasItem("ITEM_NOTE_PRESENT")));

        JsonNode created = create(first.getItems().get(0).getId(), second.getItems().get(0).getId());
        long batchId = created.path("id").asLong();
        long version = created.path("version").asLong();
        mockMvc.perform(post("/api/wash-batches/{id}/mark-ready", batchId)
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":" + version + "}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("READY"))
            .andExpect(jsonPath("$.warnings", hasItems("ITEM_NOTE_PRESENT", "DIFFERENT_ITEM_TYPES", "PRIORITY_ITEM", "PROMISED_TIME_SOON")));

        JsonNode ready = body(mockMvc.perform(get("/api/wash-batches/{id}", batchId)
            .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())).andExpect(status().isOk()).andReturn());
        mockMvc.perform(post("/api/wash-batches/{id}/cancel", batchId)
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":" + ready.path("version").asLong() + ",\"reason\":\"Đổi kế hoạch vận hành\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));

        mockMvc.perform(get("/api/wash-batches/candidates").param("branchId", branchA.getId().toString()).header("Authorization", bearer(managerA)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items", hasSize(2)));
        mockMvc.perform(get("/api/wash-batches/{id}/history", batchId)
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(3)))
            .andExpect(content().string(not(containsString("Cần xử lý nhẹ"))));
        org.junit.jupiter.api.Assertions.assertEquals(OrderStatus.RECEIVED, orders.findById(first.getId()).orElseThrow().getStatus());
    }

    @Test
    void rejectsDuplicateAssignmentAndStaleMutation() throws Exception {
        LaundryOrder order = order(branchA, wash, shirt, SharingMode.SHARED_STANDARD, null, null);
        long itemId = order.getItems().get(0).getId();
        JsonNode created = create(itemId);
        createRequest(itemId).andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("BATCH_ITEM_ALREADY_ASSIGNED"));
        mockMvc.perform(patch("/api/wash-batches/{id}/note", created.path("id").asLong())
                .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":999,\"note\":\"stale\"}"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("BATCH_VERSION_CONFLICT"));
    }

    @Test
    void enforcesServicePrivateLoadAndBranchCompatibility() throws Exception {
        LaundryOrder washOrder = order(branchA, wash, shirt, SharingMode.PRIVATE_LOAD, null, null);
        LaundryOrder otherWashOrder = order(branchA, wash, blanket, SharingMode.SHARED_STANDARD, null, null);
        LaundryOrder dryOrder = order(branchA, dry, shirt, SharingMode.SHARED_STANDARD, null, null);
        createRequest(washOrder.getItems().get(0).getId(), otherWashOrder.getItems().get(0).getId())
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.detail", containsString("PRIVATE_LOAD_CONFLICT")));
        createRequest(otherWashOrder.getItems().get(0).getId(), dryOrder.getItems().get(0).getId())
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.detail", containsString("DIFFERENT_SERVICE")));
        LaundryOrder branchBOrder = order(branchB, wash, shirt, SharingMode.SHARED_STANDARD, null, null);
        createRequest(branchBOrder.getItems().get(0).getId()).andExpect(status().isNotFound());
    }

    @Test
    void hidesOtherBranchBatches() throws Exception {
        LaundryOrder order = order(branchA, wash, shirt, SharingMode.SHARED_STANDARD, null, null);
        long id = create(order.getItems().get(0).getId()).path("id").asLong();
        mockMvc.perform(get("/api/wash-batches/{id}", id).header("Authorization", bearer(managerB)).header("X-Branch-Id", branchB.getId()))
            .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/wash-batches").param("branchId", branchB.getId().toString()).header("Authorization", bearer(managerB)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get("/api/wash-batches/candidates").param("branchId", branchB.getId().toString()).header("Authorization", bearer(managerB)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get("/api/wash-batches/{id}/history", id).header("Authorization", bearer(managerB)).header("X-Branch-Id", branchB.getId()))
            .andExpect(status().isNotFound());
    }

    @Test
    void rejectsEmptyAndEveryNonReceivedOrderStatus() throws Exception {
        createRequest().andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"));
        for (OrderStatus state : List.of(OrderStatus.CANCELLED, OrderStatus.PROCESSING, OrderStatus.READY, OrderStatus.COMPLETED, OrderStatus.REOPENED)) {
            LaundryOrder order = order(branchA, wash, shirt, SharingMode.SHARED_STANDARD, null, null);
            order.transition(state, actorA, "test state");
            orders.saveAndFlush(order);
            createRequest(order.getItems().get(0).getId()).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail", containsString("ORDER_NOT_WAITING")));
        }
        mockMvc.perform(get("/api/wash-batches/candidates").param("branchId", branchA.getId().toString()).header("Authorization", bearer(managerA)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void privateLoadAllowsItemsFromSameOrderButNotOtherOrders() throws Exception {
        LaundryOrder privateOrder = order(branchA, wash, shirt, SharingMode.PRIVATE_LOAD, null, null);
        privateOrder.addItem(item(wash, blanket, SharingMode.PRIVATE_LOAD, null));
        orders.saveAndFlush(privateOrder);
        createRequest(privateOrder.getItems().get(0).getId(), privateOrder.getItems().get(1).getId())
            .andExpect(status().isCreated()).andExpect(jsonPath("$.summary.itemCount").value(2));

        LaundryOrder other = order(branchA, wash, shirt, SharingMode.SHARED_STANDARD, null, null);
        createRequest(privateOrder.getItems().get(0).getId(), other.getItems().get(0).getId())
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("BATCH_ITEM_ALREADY_ASSIGNED"));
    }

    @Test
    void draftCompositionIsAtomicFinalItemIsProtectedAndReadyIsImmutable() throws Exception {
        LaundryOrder first = order(branchA, wash, shirt, SharingMode.SHARED_STANDARD, null, null);
        LaundryOrder second = order(branchA, wash, blanket, SharingMode.SHARED_STANDARD, null, null);
        LaundryOrder incompatible = order(branchA, dry, shirt, SharingMode.SHARED_STANDARD, null, null);
        JsonNode created = create(first.getItems().get(0).getId());
        long id = created.path("id").asLong();

        mockMvc.perform(post("/api/wash-batches/{id}/add-items", id).header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":" + created.path("version").asLong() + ",\"orderItemIds\":[" + second.getItems().get(0).getId() + "," + incompatible.getItems().get(0).getId() + "]}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.errorCode").value("BATCH_INCOMPATIBLE"));
        JsonNode unchanged = detail(id);
        org.junit.jupiter.api.Assertions.assertEquals(1, unchanged.path("summary").path("itemCount").asInt());

        JsonNode added = body(mockMvc.perform(post("/api/wash-batches/{id}/add-items", id).header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":" + unchanged.path("version").asLong() + ",\"orderItemIds\":[" + second.getItems().get(0).getId() + "]}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.summary.itemCount").value(2)).andReturn());
        JsonNode removed = body(mockMvc.perform(post("/api/wash-batches/{id}/remove-items", id).header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":" + added.path("version").asLong() + ",\"orderItemIds\":[" + second.getItems().get(0).getId() + "]}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.summary.itemCount").value(1)).andReturn());
        mockMvc.perform(post("/api/wash-batches/{id}/remove-items", id).header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":" + removed.path("version").asLong() + ",\"orderItemIds\":[" + first.getItems().get(0).getId() + "]}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.errorCode").value("BATCH_ITEMS_REQUIRED"));
        JsonNode ready = body(mockMvc.perform(post("/api/wash-batches/{id}/mark-ready", id).header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":" + removed.path("version").asLong() + "}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("READY")).andReturn());
        mockMvc.perform(post("/api/wash-batches/{id}/add-items", id).header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":" + ready.path("version").asLong() + ",\"orderItemIds\":[" + second.getItems().get(0).getId() + "]}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.errorCode").value("BATCH_IMMUTABLE"));
        mockMvc.perform(get("/api/wash-batches/{id}/history", id).header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId()))
            .andExpect(status().isOk()).andExpect(content().string(containsString("ITEMS_ADDED")))
            .andExpect(content().string(containsString("ITEMS_REMOVED"))).andExpect(content().string(containsString("MARKED_READY")));
    }

    @Test
    void draftCancelReleasesItemWithoutChangingPricingMoneyCurrencyAndListPaginates() throws Exception {
        LaundryOrder first = order(branchA, wash, shirt, SharingMode.SHARED_STANDARD, null, null);
        LaundryOrder second = order(branchA, wash, blanket, SharingMode.SHARED_STANDARD, null, null);
        BigDecimal total = first.getTotalAmount();
        String currency = first.getCurrency();
        String snapshot = first.getItems().get(0).getPricingSnapshotJson();
        JsonNode firstBatch = create(first.getItems().get(0).getId());
        create(second.getItems().get(0).getId());

        mockMvc.perform(get("/api/wash-batches").param("branchId", branchA.getId().toString()).param("page", "0").param("size", "1")
                .header("Authorization", bearer(managerA)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items", hasSize(1)))
            .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.totalPages").value(2));
        mockMvc.perform(post("/api/wash-batches/{id}/cancel", firstBatch.path("id").asLong()).header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":" + firstBatch.path("version").asLong() + ",\"reason\":\"Đổi lịch\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        mockMvc.perform(get("/api/wash-batches/candidates").param("branchId", branchA.getId().toString()).header("Authorization", bearer(managerA)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].orderItemId").value(first.getItems().get(0).getId()));
        LaundryOrder reloaded = orders.findById(first.getId()).orElseThrow();
        org.junit.jupiter.api.Assertions.assertAll(
            () -> org.junit.jupiter.api.Assertions.assertEquals(OrderStatus.RECEIVED, reloaded.getStatus()),
            () -> org.junit.jupiter.api.Assertions.assertEquals(0, total.compareTo(reloaded.getTotalAmount())),
            () -> org.junit.jupiter.api.Assertions.assertEquals(currency, reloaded.getCurrency()),
            () -> org.junit.jupiter.api.Assertions.assertEquals(snapshot, reloaded.getItems().get(0).getPricingSnapshotJson()));
    }

    @Test
    void markReadyRevalidatesOrderAndReceptionistCannotCancelOrReadAudit() throws Exception {
        LaundryOrder order = order(branchA, wash, shirt, SharingMode.SHARED_STANDARD, null, null);
        JsonNode created = create(order.getItems().get(0).getId());
        order.transition(OrderStatus.PROCESSING, actorA, null);
        orders.saveAndFlush(order);
        mockMvc.perform(post("/api/wash-batches/{id}/mark-ready", created.path("id").asLong()).header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":" + created.path("version").asLong() + "}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.detail", containsString("ORDER_NOT_WAITING")));

        UserAccount receptionist = account("batch.reception." + UUID.randomUUID().toString().substring(0, 6), branchA, "RECEPTIONIST");
        String token = login(receptionist.getUsername());
        mockMvc.perform(get("/api/wash-batches").param("branchId", branchA.getId().toString()).header("Authorization", bearer(token))).andExpect(status().isOk());
        mockMvc.perform(get("/api/wash-batches/{id}/history", created.path("id").asLong()).header("Authorization", bearer(token)).header("X-Branch-Id", branchA.getId())).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/wash-batches/{id}/cancel", created.path("id").asLong()).header("Authorization", bearer(token)).header("X-Branch-Id", branchA.getId())
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":" + created.path("version").asLong() + ",\"reason\":\"Không đủ quyền\"}"))
            .andExpect(status().isForbidden());
    }

    private JsonNode detail(long id) throws Exception { return body(mockMvc.perform(get("/api/wash-batches/{id}", id)
        .header("Authorization", bearer(managerA)).header("X-Branch-Id", branchA.getId())).andExpect(status().isOk()).andReturn()); }

    private JsonNode create(long... itemIds) throws Exception {
        MvcResult result = createRequest(itemIds).andExpect(status().isCreated())
            .andExpect(jsonPath("$.batchCode", matchesPattern(branchA.getCode() + "-MG-[0-9]{6}")))
            .andExpect(jsonPath("$.status").value("DRAFT")).andReturn();
        return body(result);
    }

    private ResultActions createRequest(long... itemIds) throws Exception {
        ObjectNode request = json.createObjectNode();
        request.put("branchId", branchA.getId());
        request.put("note", "Ghi chú nội bộ không được đưa vào audit");
        request.put("markReady", false);
        var values = request.putArray("orderItemIds");
        for (long itemId : itemIds) values.add(itemId);
        return mockMvc.perform(post("/api/wash-batches").header("Authorization", bearer(managerA))
            .contentType(MediaType.APPLICATION_JSON).content(request.toString()));
    }

    private LaundryOrder order(Branch branch, LaundryService service, ItemType itemType, SharingMode sharing, String note, Instant promisedAt) {
        orderSequence++;
        LaundryOrder order = new LaundryOrder(branch.getCode() + "-DH-T" + orderSequence, branch, null,
            "Khách bí mật " + orderSequence, "09000000" + orderSequence, promisedAt, null, "VND", actorA);
        order.addItem(item(service, itemType, sharing, note));
        return orders.saveAndFlush(order);
    }

    private OrderItem item(LaundryService service, ItemType itemType, SharingMode sharing, String note) {
        return new OrderItem(service, itemType, service.getCode(), service.getNameVi(), itemType.getCode(), itemType.getNameVi(),
            PricingMethod.BY_WEIGHT, UnitType.KG, sharing, new BigDecimal("2.500"), new BigDecimal("2.500"),
            new BigDecimal("50000"), note, "{}", Instant.now());
    }

    private UserAccount account(String username, Branch branch) {
        return account(username, branch, "MANAGER");
    }

    private UserAccount account(String username, Branch branch, String roleCode) {
        Role manager = roles.findByCode(roleCode).orElseThrow();
        UserAccount account = new UserAccount(username, passwords.encode(PASSWORD), username, branch);
        account.addRole(manager);
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

    private JsonNode body(MvcResult result) throws Exception { return json.readTree(result.getResponse().getContentAsByteArray()); }
    private String bearer(String token) { return "Bearer " + token; }
}
