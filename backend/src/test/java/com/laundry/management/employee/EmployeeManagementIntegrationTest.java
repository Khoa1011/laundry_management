package com.laundry.management.employee;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
import com.laundry.management.employee.infrastructure.EmployeeAuditRepository;
import com.laundry.management.employee.infrastructure.EmployeeBranchRepository;
import com.laundry.management.employee.infrastructure.EmployeePositionRepository;
import com.laundry.management.employee.infrastructure.EmployeeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class EmployeeManagementIntegrationTest {

    private static final String PASSWORD = "employee-integration-password";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private EmployeeAuditRepository auditRepository;
    @Autowired private EmployeeBranchRepository employeeBranchRepository;
    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private EmployeePositionRepository positionRepository;
    @Autowired private UserAccountRepository userRepository;
    @Autowired private BranchRepository branchRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JdbcTemplate jdbcTemplate;

    private Branch branchA;
    private Branch branchB;
    private Long positionId;
    private String ownerToken;
    private String managerAToken;
    private UserAccount managerA;
    private UserAccount receptionistA;

    @BeforeEach
    void setUp() throws Exception {
        jdbcTemplate.update("delete from notification_recipients");
        jdbcTemplate.update("delete from notification_preferences");
        jdbcTemplate.update("delete from notifications");
        auditRepository.deleteAll();
        employeeBranchRepository.deleteAll();
        employeeRepository.deleteAll();
        jdbcTemplate.update("delete from employee_positions where created_by is not null");
        jdbcTemplate.update("delete from authorization_audit_logs");
        jdbcTemplate.update("update users set locked_at = null, locked_reason = null, locked_by = null");
        jdbcTemplate.update("delete from user_permission_overrides where user_id in "
            + "(select id from users where username like 'employee.%')");
        jdbcTemplate.update("delete from user_roles where user_id in "
            + "(select id from users where username like 'employee.%')");
        jdbcTemplate.update("delete from user_branches where user_id in "
            + "(select id from users where username like 'employee.%')");
        jdbcTemplate.update("delete from users where username like 'employee.%'");
        jdbcTemplate.update("delete from branches where code in ('EA', 'EB')");

        branchA = branchRepository.save(new Branch("EA", "Employee branch A"));
        branchB = branchRepository.save(new Branch("EB", "Employee branch B"));
        Role owner = roleRepository.findByCode("OWNER").orElseThrow();
        Role manager = roleRepository.findByCode("MANAGER").orElseThrow();
        Role receptionist = roleRepository.findByCode("RECEPTIONIST").orElseThrow();
        createUser("employee.owner", "Employee Owner", owner, branchA, branchB);
        managerA = createUser("employee.manager.a", "Employee Manager A", manager, branchA);
        receptionistA = createUser("employee.reception.a", "Employee Reception A", receptionist, branchA);
        positionId = positionRepository.findByActiveTrueOrderBySortOrderAscNameViAscIdAsc().get(0).getId();
        ownerToken = login("employee.owner");
        managerAToken = login("employee.manager.a");
    }

    @Test
    void structuredAddressRoundTripsAdministrativeCodes() throws Exception {
        ObjectNode request = createRequest("Structured address employee", branchA.getId(), null);
        request.put("address", "12 Main Street");
        request.put("administrativeVersion", "V1");
        request.put("province", "Ho Chi Minh City");
        request.put("provinceCode", 79);
        request.put("district", "District 1");
        request.put("districtCode", 760);
        request.put("ward", "Ben Thanh Ward");
        request.put("wardCode", 26734);

        MvcResult result = mockMvc.perform(post("/api/employees")
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(request.toString()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.administrativeVersion").value("V1"))
            .andExpect(jsonPath("$.provinceCode").value(79))
            .andExpect(jsonPath("$.districtCode").value(760))
            .andExpect(jsonPath("$.wardCode").value(26734))
            .andReturn();

        long employeeId = body(result).path("id").asLong();
        mockMvc.perform(get("/api/employees/{id}", employeeId)
                .header("Authorization", bearer(managerAToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.address").value("12 Main Street"))
            .andExpect(jsonPath("$.administrativeVersion").value("V1"))
            .andExpect(jsonPath("$.provinceCode").value(79))
            .andExpect(jsonPath("$.districtCode").value(760))
            .andExpect(jsonPath("$.wardCode").value(26734));
    }

    @Test
    void managerCreatesAndReadsOnlyEmployeesWithinAssignedBranch() throws Exception {
        JsonNode employeeA = createEmployee(managerAToken, "Scoped employee A", branchA.getId(), null);
        JsonNode employeeB = createEmployee(ownerToken, "Scoped employee B", branchB.getId(), null);

        mockMvc.perform(get("/api/employees").header("Authorization", bearer(managerAToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items", hasSize(1)))
            .andExpect(jsonPath("$.items[0].id").value(employeeA.path("id").asLong()));

        mockMvc.perform(get("/api/employees/{id}", employeeB.path("id").asLong())
                .header("Authorization", bearer(managerAToken)))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.errorCode").value("EMPLOYEE_NOT_FOUND"));

        mockMvc.perform(post("/api/employees")
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(createRequest("Outside scope", branchB.getId(), null).toString()))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.errorCode").value("EMPLOYEE_SCOPE_DENIED"));
    }

    @Test
    void accountLinkRequiresEveryAccountBranchToBeWithinActorScope() throws Exception {
        UserAccount crossBranchAccount = createUser(
            "employee.cross.branch",
            "Cross Branch Account",
            roleRepository.findByCode("RECEPTIONIST").orElseThrow(),
            branchA,
            branchB
        );
        JsonNode employee = createEmployee(managerAToken, "Account scope target", branchA.getId(), null);

        mockMvc.perform(get("/api/employees/account-options")
                .header("Authorization", bearer(managerAToken))
                .param("search", "Cross Branch Account"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items", hasSize(0)));

        mockMvc.perform(put("/api/employees/{id}/account", employee.path("id").asLong())
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":" + crossBranchAccount.getId() + ",\"version\":"
                    + employee.path("version").asLong() + "}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.errorCode").value("EMPLOYEE_SCOPE_DENIED"));
    }

    @Test
    void suspendRequiresReasonAndLocksLinkedAccountInSameTransaction() throws Exception {
        JsonNode employee = createEmployee(
            managerAToken,
            "Linked receptionist",
            branchA.getId(),
            receptionistA.getId()
        );
        long employeeId = employee.path("id").asLong();
        long version = employee.path("version").asLong();

        mockMvc.perform(patch("/api/employees/{id}/status", employeeId)
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"SUSPENDED\",\"version\":" + version + "}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errorCode").value("EMPLOYEE_STATUS_REASON_REQUIRED"));

        mockMvc.perform(patch("/api/employees/{id}/status", employeeId)
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"SUSPENDED\",\"reason\":\"Policy review\",\"version\":" + version + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUSPENDED"))
            .andExpect(jsonPath("$.account.status").value("ACCOUNT_LOCKED"));

        org.assertj.core.api.Assertions.assertThat(
            userRepository.findById(receptionistA.getId()).orElseThrow().isLocked()
        ).isTrue();
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody("employee.reception.a")))
            .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/employees/{id}/audit", employeeId)
                .header("Authorization", bearer(managerAToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[?(@.action == 'EMPLOYEE_STATUS_CHANGED')]", hasSize(1)))
            .andExpect(jsonPath("$.items[?(@.action == 'LINKED_USER_LOCKED')]", hasSize(1)));
    }

    @Test
    void branchLifecycleRequiresReplacementPrimaryAndRejectsStaleVersion() throws Exception {
        JsonNode employee = createEmployee(ownerToken, "Multi branch employee", branchA.getId(), null);
        long employeeId = employee.path("id").asLong();
        long originalVersion = employee.path("version").asLong();

        MvcResult assignedResult = mockMvc.perform(post("/api/employees/{id}/branches", employeeId)
                .header("Authorization", bearer(ownerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"branchId\":" + branchB.getId() + ",\"primary\":false,\"version\":" + originalVersion + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.branches", hasSize(2)))
            .andReturn();
        long assignedVersion = body(assignedResult).path("version").asLong();

        mockMvc.perform(delete("/api/employees/{id}/branches/{branchId}", employeeId, branchA.getId())
                .header("Authorization", bearer(ownerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":" + assignedVersion + "}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("EMPLOYEE_PRIMARY_BRANCH_REQUIRED"));

        MvcResult primaryResult = mockMvc.perform(patch(
                "/api/employees/{id}/branches/{branchId}/primary", employeeId, branchB.getId())
                .header("Authorization", bearer(ownerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":" + assignedVersion + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.branches[0].id").value(branchB.getId()))
            .andExpect(jsonPath("$.branches[0].primary").value(true))
            .andReturn();
        long primaryVersion = body(primaryResult).path("version").asLong();

        mockMvc.perform(delete("/api/employees/{id}/branches/{branchId}", employeeId, branchA.getId())
                .header("Authorization", bearer(ownerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":" + originalVersion + "}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("EMPLOYEE_VERSION_CONFLICT"));

        mockMvc.perform(delete("/api/employees/{id}/branches/{branchId}", employeeId, branchA.getId())
                .header("Authorization", bearer(ownerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":" + primaryVersion + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.branches", hasSize(1)))
            .andExpect(jsonPath("$.branches[0].id").value(branchB.getId()));
    }

    @Test
    void selfProfileDoesNotGrantEmployeeDirectoryAccessAndAccountCannotBeLinkedTwice() throws Exception {
        JsonNode selfEmployee = createEmployee(ownerToken, "Reception profile", branchA.getId(), receptionistA.getId());
        String receptionistToken = login("employee.reception.a");

        mockMvc.perform(get("/api/employees/me").header("Authorization", bearer(receptionistToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(selfEmployee.path("id").asLong()))
            .andExpect(jsonPath("$.accountStatus").value("ACCOUNT_ACTIVE"));

        mockMvc.perform(get("/api/employees").header("Authorization", bearer(receptionistToken)))
            .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/employees")
                .header("Authorization", bearer(ownerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(createRequest("Duplicate account profile", branchA.getId(), receptionistA.getId()).toString()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("EMPLOYEE_ACCOUNT_ALREADY_LINKED"));
    }

    @Test
    void filtersUpdateValidationAndNoHardDeleteEndpointRemainStable() throws Exception {
        JsonNode first = createEmployee(managerAToken, "Filter Alpha", branchA.getId(), null);
        createEmployee(managerAToken, "Filter Beta", branchA.getId(), null);

        mockMvc.perform(get("/api/employees")
                .header("Authorization", bearer(managerAToken))
                .param("search", "Alpha")
                .param("status", "ACTIVE")
                .param("positionId", String.valueOf(positionId))
                .param("branchId", String.valueOf(branchA.getId()))
                .param("accountStatus", "NO_ACCOUNT")
                .queryParam("sort", "employeeCode,asc")
                .param("size", "1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items", hasSize(1)))
            .andExpect(jsonPath("$.totalElements").value(1));

        long employeeId = first.path("id").asLong();
        long version = first.path("version").asLong();
        mockMvc.perform(put("/api/employees/{id}", employeeId)
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "fullName":"Filter Alpha Updated",
                      "phone":"0909876543",
                      "email":"updated@example.test",
                      "birthDate":"1990-01-01",
                      "address":"Updated address",
                      "hireDate":"2026-07-02",
                      "version":%d
                    }
                    """.formatted(version)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.fullName").value("Filter Alpha Updated"))
            .andExpect(jsonPath("$.employeeCode").value(first.path("employeeCode").asText()));

        mockMvc.perform(delete("/api/employees/{id}", employeeId)
                .header("Authorization", bearer(ownerToken)))
            .andExpect(status().isMethodNotAllowed());

        ObjectNode invalid = createRequest("A", branchA.getId(), null);
        invalid.put("email", "invalid-email");
        invalid.put("birthDate", "2999-01-01");
        mockMvc.perform(post("/api/employees")
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalid.toString()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"))
            .andExpect(jsonPath("$.fieldErrors.fullName").exists())
            .andExpect(jsonPath("$.fieldErrors.email").exists())
            .andExpect(jsonPath("$.fieldErrors.birthDate").exists());
    }

    @Test
    void terminatedEmployeeLocksLinkedUserAndCannotBeReactivated() throws Exception {
        UserAccount linked = createUser(
            "employee.terminated.account",
            "Terminated Account",
            roleRepository.findByCode("RECEPTIONIST").orElseThrow(),
            branchA
        );
        JsonNode employee = createEmployee(managerAToken, "Terminated employee", branchA.getId(), linked.getId());
        long id = employee.path("id").asLong();

        MvcResult terminatedResult = mockMvc.perform(patch("/api/employees/{id}/status", id)
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"TERMINATED\",\"reason\":\"Employment ended\",\"version\":"
                    + employee.path("version").asLong() + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("TERMINATED"))
            .andExpect(jsonPath("$.account.status").value("ACCOUNT_LOCKED"))
            .andReturn();

        mockMvc.perform(patch("/api/employees/{id}/status", id)
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"ACTIVE\",\"version\":"
                    + body(terminatedResult).path("version").asLong() + "}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("EMPLOYEE_INVALID_STATUS_TRANSITION"));
    }

    @Test
    void inactivePositionCannotBeAssignedAndAccountActionsNeedDedicatedPermission() throws Exception {
        JsonNode position = objectMapper.readTree(mockMvc.perform(post("/api/employee-positions")
                .header("Authorization", bearer(ownerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"code":"TEMP_INACTIVE","nameVi":"Tam ngung","nameEn":"Inactive temporary","sortOrder":99}
                    """))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsByteArray());
        mockMvc.perform(patch("/api/employee-positions/{id}", position.path("id").asLong())
                .header("Authorization", bearer(ownerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "nameVi":"Tam ngung",
                      "nameEn":"Inactive temporary",
                      "active":false,
                      "sortOrder":99,
                      "version":%d
                    }
                    """.formatted(position.path("version").asLong())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(false));

        ObjectNode request = createRequest("Inactive position employee", branchA.getId(), null);
        request.put("positionId", position.path("id").asLong());
        mockMvc.perform(post("/api/employees")
                .header("Authorization", bearer(managerAToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(request.toString()))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.errorCode").value("EMPLOYEE_POSITION_INACTIVE"));

        JsonNode employee = createEmployee(ownerToken, "Permission target", branchA.getId(), null);
        String receptionistToken = login("employee.reception.a");
        mockMvc.perform(put("/api/employees/{id}/account", employee.path("id").asLong())
                .header("Authorization", bearer(receptionistToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":" + receptionistA.getId() + ",\"version\":" + employee.path("version").asLong() + "}"))
            .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/employees/{id}/status", employee.path("id").asLong())
                .header("Authorization", bearer(receptionistToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"INACTIVE\",\"version\":" + employee.path("version").asLong() + "}"))
            .andExpect(status().isForbidden());
    }

    @Test
    void manageAllScopeAloneGrantsNoActionAndUserDenyOverridesManagerRoleGrant() throws Exception {
        JsonNode scopeOnlyRole = objectMapper.readTree(mockMvc.perform(post("/api/access/roles")
                .header("Authorization", bearer(ownerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"Employee scope only\"}"))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsByteArray());
        MvcResult matrixResult = mockMvc.perform(put(
                "/api/access/roles/{roleId}/permissions", scopeOnlyRole.path("id").asLong())
                .header("Authorization", bearer(ownerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"permissionCodes\":[\"employee.manage-all-branches\"],\"version\":"
                    + scopeOnlyRole.path("version").asLong() + ",\"reason\":\"Scope-only security test\"}"))
            .andExpect(status().isOk())
            .andReturn();
        Role scopeRole = roleRepository.findById(body(matrixResult).path("role").path("id").asLong()).orElseThrow();
        createUser("employee.scope.only", "Employee Scope Only", scopeRole, branchA);
        mockMvc.perform(get("/api/employees").header("Authorization", bearer(login("employee.scope.only"))))
            .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/access/users/{userId}/overrides", managerA.getId())
                .header("Authorization", bearer(ownerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "version":0,
                      "overrides":[{
                        "permissionCode":"employee.read",
                        "effect":"DENY",
                        "reason":"Employee directory separation test"
                      }]
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.effectivePermissions[?(@ == 'employee.read')]").isEmpty());

        mockMvc.perform(get("/api/employees").header("Authorization", bearer(login("employee.manager.a"))))
            .andExpect(status().isForbidden());
    }

    private JsonNode createEmployee(String token, String fullName, Long branchId, Long linkedUserId) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/employees")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(createRequest(fullName, branchId, linkedUserId).toString()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.employeeCode").value(org.hamcrest.Matchers.matchesPattern("NV-\\d{6,}")))
            .andReturn().getResponse().getContentAsByteArray());
    }

    private ObjectNode createRequest(String fullName, Long branchId, Long linkedUserId) {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("fullName", fullName);
        request.put("phone", "0901234567");
        request.put("email", fullName.toLowerCase().replace(' ', '.') + "@example.test");
        request.put("hireDate", "2026-07-01");
        request.put("positionId", positionId);
        request.put("status", "ACTIVE");
        request.putArray("branchIds").add(branchId);
        request.put("primaryBranchId", branchId);
        if (linkedUserId != null) request.put("linkedUserId", linkedUserId);
        return request;
    }

    private UserAccount createUser(String username, String displayName, Role role, Branch... branches) {
        UserAccount user = new UserAccount(username, passwordEncoder.encode(PASSWORD), displayName, branches[0]);
        user.addRole(role);
        user = userRepository.saveAndFlush(user);
        for (int index = 0; index < branches.length; index++) user.assignBranch(branches[index], index == 0);
        return userRepository.saveAndFlush(user);
    }

    private String login(String username) throws Exception {
        JsonNode response = objectMapper.readTree(mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody(username)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsByteArray());
        return response.path("accessToken").asText();
    }

    private String loginBody(String username) {
        return "{\"username\":\"" + username + "\",\"password\":\"" + PASSWORD + "\"}";
    }

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
