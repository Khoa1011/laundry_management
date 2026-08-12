package com.laundry.management.servicecatalog;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.Role;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.RoleRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.servicecatalog.infrastructure.ItemTypeRepository;
import com.laundry.management.servicecatalog.infrastructure.LaundryServiceRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceListRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceRuleRepository;
import com.laundry.management.servicecatalog.infrastructure.PricingAuditRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
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
class ServiceCatalogIntegrationTest {

    private static final String PASSWORD = "catalog-integration-password";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired UserAccountRepository userRepository;
    @Autowired BranchRepository branchRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired PricingAuditRepository auditRepository;
    @Autowired PriceRuleRepository ruleRepository;
    @Autowired PriceListRepository listRepository;
    @Autowired ItemTypeRepository itemTypeRepository;
    @Autowired LaundryServiceRepository serviceRepository;

    private Branch branchA;
    private String managerAToken;
    private String managerBToken;
    private String receptionistToken;

    @BeforeEach
    void setUp() throws Exception {
        auditRepository.deleteAll();
        ruleRepository.deleteAll();
        listRepository.deleteAll();
        itemTypeRepository.deleteAll();
        serviceRepository.deleteAll();

        String runId = UUID.randomUUID().toString().substring(0, 8);
        String managerAUsername = "catalog.manager.a." + runId;
        String managerBUsername = "catalog.manager.b." + runId;
        String receptionistUsername = "catalog.reception.a." + runId;
        branchA = branchRepository.save(new Branch("CATA-" + runId, "Chi nhánh Catalog A"));
        Branch branchB = branchRepository.save(new Branch("CATB-" + runId, "Chi nhánh Catalog B"));
        String passwordHash = passwordEncoder.encode(PASSWORD);
        createAccount(managerAUsername, "Catalog Manager A", passwordHash, branchA, "MANAGER");
        createAccount(managerBUsername, "Catalog Manager B", passwordHash, branchB, "MANAGER");
        createAccount(receptionistUsername, "Catalog Reception A", passwordHash, branchA, "RECEPTIONIST");
        managerAToken = login(managerAUsername);
        managerBToken = login(managerBUsername);
        receptionistToken = login(receptionistUsername);
    }

    @Test
    void publishesVersionedListsResolvesCurrentAndScheduledPricesAndEnforcesBranchScope() throws Exception {
        JsonNode service = createService();
        long serviceId = service.path("id").asLong();
        long serviceVersion = service.path("version").asLong();

        ObjectNode serviceUpdate = serviceRequest("Giặt sấy tiêu chuẩn cập nhật");
        serviceUpdate.put("version", serviceVersion);
        mockMvc.perform(put("/api/services/{id}", serviceId)
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(serviceUpdate.toString()))
            .andExpect(status().isOk());
        mockMvc.perform(put("/api/services/{id}", serviceId)
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(serviceUpdate.toString()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("PRICING_VERSION_CONFLICT"));

        Instant now = Instant.now();
        Instant currentFrom = now.minusSeconds(3600);
        JsonNode currentList = createPriceList("Bảng giá hiện hành", currentFrom);
        addWeightRule(currentList.path("id").asLong(), serviceId, effectiveFrom(currentList), "25000");
        publish(currentList);

        Instant futureFrom = now.plusSeconds(86400);
        JsonNode futureList = createPriceList("Bảng giá tháng tới", futureFrom);
        addWeightRule(futureList.path("id").asLong(), serviceId, effectiveFrom(futureList), "30000");
        publish(futureList);

        preview(managerAToken, branchA.getId(), serviceId, "2.5", now)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.priceListId").value(currentList.path("id").asLong()))
            .andExpect(jsonPath("$.finalAmount").value(62500.0))
            .andExpect(jsonPath("$.snapshot.priceRuleVersion").value(1));
        preview(managerAToken, branchA.getId(), serviceId, "2.5", futureFrom.plusSeconds(60))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.priceListId").value(futureList.path("id").asLong()))
            .andExpect(jsonPath("$.finalAmount").value(75000.0));

        preview(managerBToken, branchA.getId(), serviceId, "2.5", now)
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.errorCode").value("BRANCH_ACCESS_DENIED"));

        mockMvc.perform(get("/api/price-lists/{id}/history", currentList.path("id").asLong())
                .header("Authorization", bearer(managerAToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements", greaterThanOrEqualTo(3)))
            .andExpect(jsonPath("$.items[*].action", hasItem("PRICE_RULE_CREATED")))
            .andExpect(jsonPath("$.items[?(@.action == 'PRICE_RULE_CREATED')].newValue.unitPrice", hasItem(25000)));
    }

    @Test
    void receptionistCanPreviewButCannotMutateCatalog() throws Exception {
        JsonNode service = createService();
        Instant from = Instant.now().minusSeconds(60);
        JsonNode list = createPriceList("Bảng giá lễ tân", from);
        addWeightRule(list.path("id").asLong(), service.path("id").asLong(), effectiveFrom(list), "20000");
        publish(list);

        preview(receptionistToken, branchA.getId(), service.path("id").asLong(), "3", Instant.now())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.finalAmount").value(60000.0));
        mockMvc.perform(post("/api/services")
                .header("Authorization", bearer(receptionistToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(serviceRequest("Không được tạo").toString()))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    private JsonNode createService() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/services")
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(serviceRequest("Giặt sấy tiêu chuẩn").toString()))
            .andExpect(status().isCreated())
            .andReturn();
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

    private JsonNode createPriceList(String name, Instant effectiveFrom) throws Exception {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("name", name);
        request.put("branchId", branchA.getId());
        request.put("currency", "VND");
        request.put("effectiveFrom", effectiveFrom.toString());
        MvcResult result = mockMvc.perform(post("/api/price-lists")
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(request.toString()))
            .andExpect(status().isCreated())
            .andReturn();
        return body(result);
    }

    private Instant effectiveFrom(JsonNode priceList) {
        // Keep the rule strictly inside the list window so database timestamp precision
        // differences cannot make two logically equal boundaries compare out of range.
        return Instant.parse(priceList.path("effectiveFrom").asText()).plusSeconds(1);
    }

    private void addWeightRule(long priceListId, long serviceId, Instant effectiveFrom, String unitPrice)
        throws Exception {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("serviceId", serviceId);
        request.put("pricingMethod", "BY_WEIGHT");
        request.put("unitType", "KG");
        request.put("sharingMode", "ANY");
        request.put("unitPrice", unitPrice);
        request.put("rulePriority", 0);
        request.put("effectiveFrom", effectiveFrom.toString());
        request.putArray("tiers");
        mockMvc.perform(post("/api/price-lists/{id}/rules", priceListId)
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(request.toString()))
            .andExpect(status().isCreated());
    }

    private void publish(JsonNode list) throws Exception {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("version", list.path("version").asLong());
        request.put("reason", "Integration test publication");
        mockMvc.perform(post("/api/price-lists/{id}/publish", list.path("id").asLong())
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(request.toString()))
            .andExpect(status().isOk());
    }

    private org.springframework.test.web.servlet.ResultActions preview(
        String token,
        long branchId,
        long serviceId,
        String quantity,
        Instant effectiveAt
    ) throws Exception {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("branchId", branchId);
        request.put("serviceId", serviceId);
        request.put("sharingMode", "ANY");
        request.put("quantity", quantity);
        request.put("effectiveAt", effectiveAt.toString());
        return mockMvc.perform(post("/api/pricing/preview")
            .header("Authorization", bearer(token))
            .contentType(MediaType.APPLICATION_JSON)
            .content(request.toString()));
    }

    private void createAccount(
        String username,
        String displayName,
        String passwordHash,
        Branch branch,
        String roleCode
    ) {
        Role role = roleRepository.findByCode(roleCode).orElseThrow();
        UserAccount account = new UserAccount(username, passwordHash, displayName, branch);
        account.addRole(role);
        account = userRepository.saveAndFlush(account);
        account.assignBranch(branch, true);
        userRepository.saveAndFlush(account);
    }

    private String login(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"password\":\"" + PASSWORD + "\"}"))
            .andExpect(status().isOk())
            .andReturn();
        return body(result).path("accessToken").asText();
    }

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
