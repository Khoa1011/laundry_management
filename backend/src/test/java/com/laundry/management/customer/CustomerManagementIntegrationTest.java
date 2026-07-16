package com.laundry.management.customer;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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
import com.laundry.management.customer.infrastructure.CustomerActivityRepository;
import com.laundry.management.customer.infrastructure.CustomerAddressRepository;
import com.laundry.management.customer.infrastructure.CustomerRepository;
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
class CustomerManagementIntegrationTest {

    private static final String PASSWORD = "integration-test-password";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CustomerActivityRepository activityRepository;

    @Autowired
    private CustomerAddressRepository addressRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private UserAccountRepository userAccountRepository;

    @Autowired
    private BranchRepository branchRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private Branch branchA;
    private Branch branchB;
    private String managerAToken;
    private String managerBToken;
    private String receptionistToken;

    @BeforeEach
    void setUp() throws Exception {
        activityRepository.deleteAll();
        addressRepository.deleteAll();
        customerRepository.deleteAll();
        userAccountRepository.deleteAll();
        branchRepository.deleteAll();

        branchA = branchRepository.save(new Branch("A", "Chi nhánh A"));
        branchB = branchRepository.save(new Branch("B", "Chi nhánh B"));
        String passwordHash = passwordEncoder.encode(PASSWORD);
        createAccount("manager.a", "Manager A", passwordHash, branchA, "MANAGER");
        createAccount("manager.b", "Manager B", passwordHash, branchB, "MANAGER");
        createAccount("reception.a", "Reception A", passwordHash, branchA, "RECEPTIONIST");

        managerAToken = login("manager.a");
        managerBToken = login("manager.b");
        receptionistToken = login("reception.a");
    }

    @Test
    void createNormalizesPhoneGeneratesCodeCreatesDefaultAddressAndMaskedAudit() throws Exception {
        ObjectNode request = baseCustomer("Nguyễn Minh Anh", "0901 234 567", "INDIVIDUAL", "WALK_IN");
        request.put("email", "MINHANH@EXAMPLE.COM");
        request.put("note", "Ưu tiên giặt riêng đồ trắng.");
        request.set("initialAddress", addressRequest("Nguyễn Minh Anh", "+84901234567", "12 Nguyễn Trãi", false));

        MvcResult createdResult = mockMvc.perform(post("/api/customers")
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(request.toString()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.customerCode").value(org.hamcrest.Matchers.matchesPattern("KH-\\d{6,}")))
            .andExpect(jsonPath("$.phone").value("0901 234 567"))
            .andExpect(jsonPath("$.email").value("minhanh@example.com"))
            .andExpect(jsonPath("$.branch.code").value("A"))
            .andExpect(jsonPath("$.addresses", hasSize(1)))
            .andExpect(jsonPath("$.addresses[0].isDefault").value(true))
            .andReturn();
        long customerId = body(createdResult).path("id").asLong();

        mockMvc.perform(get("/api/customers/{id}/activities", customerId)
                .header("Authorization", bearer(managerAToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(2))
            .andExpect(content().string(not(containsString("0901234567"))))
            .andExpect(content().string(not(containsString("+84901234567"))));

        mockMvc.perform(get("/api/customers/{id}/activities", customerId)
                .header("Authorization", bearer(receptionistToken)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    @Test
    void equivalentPhonesCollideWithinBranchButAreAllowedAcrossBranches() throws Exception {
        JsonNode first = createCustomer(managerAToken, baseCustomer(
            "Khách A", "0901234567", "INDIVIDUAL", "WALK_IN"
        ));

        mockMvc.perform(post("/api/customers")
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(baseCustomer("Khách trùng", "+84901234567", "INDIVIDUAL", "WALK_IN").toString()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("CUSTOMER_PHONE_DUPLICATE"));

        JsonNode otherBranch = createCustomer(managerBToken, baseCustomer(
            "Khách B", "84 901 234 567", "BUSINESS", "REFERRAL"
        ));
        org.assertj.core.api.Assertions.assertThat(otherBranch.path("id").asLong())
            .isNotEqualTo(first.path("id").asLong());
    }

    @Test
    void listIsPaginatedSearchableFilterableSortableAndBranchScoped() throws Exception {
        createCustomer(managerAToken, baseCustomer("Nguyễn An", "0901111111", "INDIVIDUAL", "WALK_IN"));
        createCustomer(managerAToken, baseCustomer("Công ty Ánh Dương", "0902222222", "BUSINESS", "PARTNER"));
        createCustomer(managerBToken, baseCustomer("Nguyễn Chi nhánh B", "0903333333", "INDIVIDUAL", "WALK_IN"));

        mockMvc.perform(get("/api/customers")
                .header("Authorization", bearer(managerAToken))
                .param("page", "0")
                .param("size", "1")
                .param("sort", "fullName,asc"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items", hasSize(1)))
            .andExpect(jsonPath("$.totalElements").value(2))
            .andExpect(jsonPath("$.totalPages").value(2));

        mockMvc.perform(get("/api/customers")
                .header("Authorization", bearer(managerAToken))
                .param("search", "+84901111111"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.items[0].fullName").value("Nguyễn An"));

        mockMvc.perform(get("/api/customers")
                .header("Authorization", bearer(managerAToken))
                .param("customerType", "BUSINESS")
                .param("source", "PARTNER"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.items[0].fullName").value("Công ty Ánh Dương"));

        mockMvc.perform(get("/api/customers")
                .header("Authorization", bearer(managerAToken))
                .param("sort", "normalizedPhone,asc"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errorCode").value("INVALID_SORT"));

        mockMvc.perform(get("/api/customers")
                .header("Authorization", bearer(managerAToken))
                .param("size", "101"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errorCode").value("PAGE_SIZE_EXCEEDED"));
    }

    @Test
    void customerAndNestedResourcesCannotBeReadAcrossBranches() throws Exception {
        JsonNode created = createCustomer(managerAToken, baseCustomer(
            "Khách riêng A", "0904444444", "INDIVIDUAL", "WALK_IN"
        ));
        long customerId = created.path("id").asLong();

        mockMvc.perform(get("/api/customers/{id}", customerId)
                .header("Authorization", bearer(managerBToken)))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.errorCode").value("CUSTOMER_NOT_FOUND"));

        mockMvc.perform(get("/api/customers/{id}/addresses", customerId)
                .header("Authorization", bearer(managerBToken)))
            .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/customers/{id}/activities", customerId)
                .header("Authorization", bearer(managerBToken)))
            .andExpect(status().isNotFound());
    }

    @Test
    void updateRejectsStaleVersionAndDuplicatePhoneWithoutChangingImmutableFields() throws Exception {
        JsonNode first = createCustomer(managerAToken, baseCustomer(
            "Khách đầu", "0905555555", "INDIVIDUAL", "WALK_IN"
        ));
        JsonNode second = createCustomer(managerAToken, baseCustomer(
            "Khách sau", "0906666666", "INDIVIDUAL", "REFERRAL"
        ));
        long customerId = first.path("id").asLong();
        String originalCode = first.path("customerCode").asText();
        long version = first.path("version").asLong();

        ObjectNode update = updateRequest(first, "Khách đã sửa", "0905555555", version);
        MvcResult updatedResult = mockMvc.perform(put("/api/customers/{id}", customerId)
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(update.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.fullName").value("Khách đã sửa"))
            .andExpect(jsonPath("$.customerCode").value(originalCode))
            .andReturn();
        long latestVersion = body(updatedResult).path("version").asLong();

        mockMvc.perform(put("/api/customers/{id}", customerId)
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(update.toString()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("CUSTOMER_VERSION_CONFLICT"));

        ObjectNode duplicateUpdate = updateRequest(first, "Khách đã sửa", second.path("phone").asText(), latestVersion);
        mockMvc.perform(put("/api/customers/{id}", customerId)
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(duplicateUpdate.toString()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("CUSTOMER_PHONE_DUPLICATE"));
    }

    @Test
    void statusChangesRequireDedicatedPermissionAndSupportReactivation() throws Exception {
        JsonNode customer = createCustomer(managerAToken, baseCustomer(
            "Khách trạng thái", "0907777777", "INDIVIDUAL", "WALK_IN"
        ));
        long id = customer.path("id").asLong();
        long version = customer.path("version").asLong();
        String deactivateBody = "{\"status\":\"INACTIVE\",\"version\":" + version + "}";

        mockMvc.perform(patch("/api/customers/{id}/status", id)
                .header("Authorization", bearer(receptionistToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(deactivateBody))
            .andExpect(status().isForbidden());

        MvcResult inactiveResult = mockMvc.perform(patch("/api/customers/{id}/status", id)
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(deactivateBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("INACTIVE"))
            .andReturn();
        long inactiveVersion = body(inactiveResult).path("version").asLong();

        mockMvc.perform(patch("/api/customers/{id}/status", id)
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"ACTIVE\",\"version\":" + inactiveVersion + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    void addressLifecycleMaintainsAtMostOneActiveDefaultAndRequiresReplacement() throws Exception {
        JsonNode customer = createCustomer(managerAToken, baseCustomer(
            "Khách địa chỉ", "0908888888", "INDIVIDUAL", "WALK_IN"
        ));
        long customerId = customer.path("id").asLong();
        JsonNode first = createAddress(customerId, addressRequest("Người nhận 1", "0908888888", "Địa chỉ 1", false));
        JsonNode second = createAddress(customerId, addressRequest("Người nhận 2", "0909999999", "Địa chỉ 2", false));
        org.assertj.core.api.Assertions.assertThat(first.path("isDefault").asBoolean()).isTrue();
        org.assertj.core.api.Assertions.assertThat(second.path("isDefault").asBoolean()).isFalse();

        MvcResult promotedResult = mockMvc.perform(patch("/api/customers/{customerId}/addresses/{addressId}/default", customerId, second.path("id").asLong())
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":" + second.path("version").asLong() + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.isDefault").value(true))
            .andReturn();
        JsonNode promoted = body(promotedResult);

        mockMvc.perform(patch("/api/customers/{customerId}/addresses/{addressId}/status", customerId, promoted.path("id").asLong())
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"INACTIVE\",\"version\":" + promoted.path("version").asLong() + "}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("INVALID_DEFAULT_ADDRESS_REPLACEMENT"));

        MvcResult deactivatedResult = mockMvc.perform(patch("/api/customers/{customerId}/addresses/{addressId}/status", customerId, promoted.path("id").asLong())
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"INACTIVE\",\"version\":" + promoted.path("version").asLong()
                    + ",\"replacementAddressId\":" + first.path("id").asLong() + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("INACTIVE"))
            .andExpect(jsonPath("$.isDefault").value(false))
            .andReturn();

        MvcResult addressesResult = mockMvc.perform(get("/api/customers/{id}/addresses", customerId)
                .header("Authorization", bearer(managerAToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(first.path("id").asLong()))
            .andExpect(jsonPath("$[0].isDefault").value(true))
            .andReturn();
        long firstCurrentVersion = body(addressesResult).path(0).path("version").asLong();

        mockMvc.perform(patch("/api/customers/{customerId}/addresses/{addressId}/status", customerId, first.path("id").asLong())
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"INACTIVE\",\"version\":" + firstCurrentVersion + "}"))
            .andExpect(status().isOk());

        mockMvc.perform(patch("/api/customers/{customerId}/addresses/{addressId}/status", customerId, promoted.path("id").asLong())
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"ACTIVE\",\"version\":" + body(deactivatedResult).path("version").asLong() + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.isDefault").value(true));
    }

    @Test
    void addressUpdateThatPromotesDefaultWritesDedicatedAuditActivity() throws Exception {
        JsonNode customer = createCustomer(managerAToken, baseCustomer(
            "Khách cập nhật địa chỉ", "0901234987", "INDIVIDUAL", "WALK_IN"
        ));
        long customerId = customer.path("id").asLong();
        createAddress(customerId, addressRequest("Người nhận 1", "0901234987", "Địa chỉ 1", false));
        JsonNode second = createAddress(customerId, addressRequest("Người nhận 2", "0901234988", "Địa chỉ 2", false));
        ObjectNode update = addressRequest("Người nhận 2", "0901234988", "Địa chỉ 2 cập nhật", true);
        update.put("version", second.path("version").asLong());

        mockMvc.perform(put("/api/customers/{customerId}/addresses/{addressId}", customerId, second.path("id").asLong())
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(update.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.isDefault").value(true));

        mockMvc.perform(get("/api/customers/{id}/activities", customerId)
                .header("Authorization", bearer(managerAToken))
                .param("size", "20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[?(@.action == 'ADDRESS_DEFAULT_CHANGED')]", hasSize(1)));
    }

    @Test
    void validationReportsFieldErrorsAndRejectsFutureBirthDate() throws Exception {
        ObjectNode invalid = baseCustomer("A", "123", "INDIVIDUAL", "WALK_IN");
        invalid.put("email", "not-an-email");
        invalid.put("birthDate", "2999-01-01");

        mockMvc.perform(post("/api/customers")
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalid.toString()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"))
            .andExpect(jsonPath("$.fieldErrors.fullName").exists())
            .andExpect(jsonPath("$.fieldErrors.email").exists())
            .andExpect(jsonPath("$.fieldErrors.birthDate").exists());
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
        account = userAccountRepository.saveAndFlush(account);
        account.assignBranch(branch, true);
        userAccountRepository.saveAndFlush(account);
    }

    private String login(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"password\":\"" + PASSWORD + "\"}"))
            .andExpect(status().isOk())
            .andReturn();
        return body(result).path("accessToken").asText();
    }

    private JsonNode createCustomer(String token, ObjectNode request) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/customers")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(request.toString()))
            .andExpect(status().isCreated())
            .andReturn();
        return body(result);
    }

    private JsonNode createAddress(long customerId, ObjectNode request) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/customers/{id}/addresses", customerId)
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(request.toString()))
            .andExpect(status().isCreated())
            .andReturn();
        return body(result);
    }

    private ObjectNode baseCustomer(String name, String phone, String type, String source) {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("fullName", name);
        request.put("phone", phone);
        request.put("customerType", type);
        request.put("source", source);
        return request;
    }

    private ObjectNode addressRequest(String receiver, String phone, String address, boolean defaultAddress) {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("receiverName", receiver);
        request.put("receiverPhone", phone);
        request.put("province", "TP. Hồ Chí Minh");
        request.put("district", "Quận 1");
        request.put("ward", "Phường Bến Thành");
        request.put("addressLine", address);
        request.put("deliveryNote", "Gọi trước khi giao");
        request.put("isDefault", defaultAddress);
        return request;
    }

    private ObjectNode updateRequest(JsonNode existing, String name, String phone, long version) {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("fullName", name);
        request.put("phone", phone);
        request.put("customerType", existing.path("customerType").asText());
        request.put("source", existing.path("source").asText());
        request.put("version", version);
        return request;
    }

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
