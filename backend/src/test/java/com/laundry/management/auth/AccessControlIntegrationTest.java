package com.laundry.management.auth;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.Role;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.AuthorizationAuditRepository;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.RoleRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class AccessControlIntegrationTest {

    private static final String PASSWORD = "test-password-only";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired UserAccountRepository userRepository;
    @Autowired BranchRepository branchRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired AuthorizationAuditRepository auditRepository;

    @BeforeEach
    void setUp() {
        auditRepository.deleteAll();
        userRepository.deleteAll();
        branchRepository.deleteAll();
        List<Role> customRoles = roleRepository.findAll().stream().filter(role -> !role.isSystem()).toList();
        roleRepository.deleteAll(customRoles);

        Branch branch = branchRepository.save(new Branch("ACCESS", "Access branch"));
        createUser("owner.access", "Access Owner", roleRepository.findByCode("OWNER").orElseThrow(), branch);
        createUser("manager.access", "Access Manager", roleRepository.findByCode("MANAGER").orElseThrow(), branch);

        Branch isolated = branchRepository.save(new Branch("ISOLATED", "Isolated branch"));
        createUser("isolated.user", "Isolated User", roleRepository.findByCode("RECEPTIONIST").orElseThrow(), isolated);
    }

    @Test
    void ownerCanCreateRoleAndSaveCompletePermissionMatrix() throws Exception {
        String token = login("owner.access");
        JsonNode created = objectMapper.readTree(mockMvc.perform(post("/api/access/roles")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "displayName":"Điều phối giao nhận",
                      "description":"Điều phối giao và nhận đồ"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code", matchesPattern("CUSTOM_ROLE_[0-9]{6,}")))
            .andExpect(jsonPath("$.displayName").value("Điều phối giao nhận"))
            .andExpect(jsonPath("$.description").value("Điều phối giao và nhận đồ"))
            .andExpect(jsonPath("$.status").value("ACTIVE"))
            .andExpect(jsonPath("$.system").value(false))
            .andReturn().getResponse().getContentAsByteArray());

        long roleId = created.path("id").asLong();
        long version = created.path("version").asLong();
        mockMvc.perform(put("/api/access/roles/{roleId}/permissions", roleId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "permissionCodes":["customer.read","customer.update"],
                      "version":%d,
                      "reason":"New delivery workflow"
                    }
                    """.formatted(version)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.permissionCodes", hasItem("customer.read")))
            .andExpect(jsonPath("$.permissionCodes", hasItem("customer.update")));

        mockMvc.perform(get("/api/access/audit")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].actorDisplayName").value("Access Owner"));
    }

    @Test
    void readOnlyManagerCannotCreateRole() throws Exception {
        mockMvc.perform(post("/api/access/roles")
                .header("Authorization", "Bearer " + login("manager.access"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"displayName":"Không hợp lệ"}
                    """))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    @Test
    void userDirectoryIsRestrictedToActorsAssignedBranches() throws Exception {
        mockMvc.perform(get("/api/access/users")
                .header("Authorization", "Bearer " + login("manager.access")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[*].username", hasItem("owner.access")))
            .andExpect(jsonPath("$.items[*].username", not(hasItem("isolated.user"))));
    }

    @Test
    void currentUserReturnsLiveEffectivePermissionsAndAuthorizationVersion() throws Exception {
        mockMvc.perform(get("/api/auth/me")
                .header("Authorization", "Bearer " + login("owner.access")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.primaryRole.code").value("OWNER"))
            .andExpect(jsonPath("$.effectivePermissions", hasItem("access.role.permission.assign")))
            .andExpect(jsonPath("$.authorizationVersion").isNumber());
    }

    @Test
    void replacingExistingOverrideUpdatesInPlaceAndDenyWins() throws Exception {
        String token = login("owner.access");
        UserAccount manager = userRepository.findByUsernameIgnoreCase("manager.access").orElseThrow();
        JsonNode first = objectMapper.readTree(mockMvc.perform(put("/api/access/users/{userId}/overrides", manager.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "version":0,
                      "overrides":[{
                        "permissionCode":"customer.read",
                        "effect":"ALLOW",
                        "reason":"Temporary support"
                      }]
                    }
                    """))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsByteArray());

        mockMvc.perform(put("/api/access/users/{userId}/overrides", manager.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "version":%d,
                      "overrides":[{
                        "permissionCode":"customer.read",
                        "effect":"DENY",
                        "reason":"Separation of duties"
                      }]
                    }
                    """.formatted(first.path("version").asLong())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.effectivePermissions", not(hasItem("customer.read"))))
            .andExpect(jsonPath("$.overrides[0].effect").value("DENY"));
    }

    @Test
    void createCanCopyOnlyPermissionsAndRoleDetailUsesRealCounts() throws Exception {
        String token = login("owner.access");
        Role receptionistReference = roleRepository.findByCode("RECEPTIONIST").orElseThrow();
        Role receptionist = roleRepository.findDetailById(receptionistReference.getId()).orElseThrow();
        JsonNode created = createRole(token, """
            {
              "displayName":"Nhân viên quầy tối",
              "copyPermissionsFromRoleId":%d
            }
            """.formatted(receptionist.getId()));
        long roleId = created.path("id").asLong();

        mockMvc.perform(get("/api/access/roles/{roleId}/permissions", roleId)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.permissionCodes.length()").value(receptionist.getPermissions().size()))
            .andExpect(jsonPath("$.assignedUserCount").value(0))
            .andExpect(jsonPath("$.modules").isArray());

        UserAccount manager = userRepository.findByUsernameIgnoreCase("manager.access").orElseThrow();
        mockMvc.perform(put("/api/access/users/{userId}/role", manager.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"roleId":%d,"version":0,"reason":"Assign custom night role"}
                    """.formatted(roleId)))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/access/roles/{roleId}", roleId)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assignedUsers").value(1))
            .andExpect(jsonPath("$.permissionCount").value(receptionist.getPermissions().size()));
    }

    @Test
    void updateCustomRoleKeepsCodeAndProtectsSystemRoles() throws Exception {
        String token = login("owner.access");
        JsonNode created = createRole(token, """
            {"displayName":"Nhân viên kho","description":"Quản lý kho"}
            """);
        long roleId = created.path("id").asLong();
        String code = created.path("code").asText();

        mockMvc.perform(put("/api/access/roles/{roleId}", roleId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "displayName":"Nhân viên kho ca sáng",
                      "description":"Quản lý nhập xuất kho ca sáng",
                      "status":"INACTIVE",
                      "version":%d
                    }
                    """.formatted(created.path("version").asLong())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(code))
            .andExpect(jsonPath("$.displayName").value("Nhân viên kho ca sáng"))
            .andExpect(jsonPath("$.status").value("INACTIVE"))
            .andExpect(jsonPath("$.updatedBy.displayName").value("Access Owner"));

        Role owner = roleRepository.findByCode("OWNER").orElseThrow();
        mockMvc.perform(put("/api/access/roles/{roleId}", owner.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "displayName":"Unsafe owner rename",
                      "description":"Unsafe",
                      "status":"ACTIVE",
                      "version":%d
                    }
                    """.formatted(owner.getVersion())))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.errorCode").value("SYSTEM_ROLE_PROTECTED"));
    }

    @Test
    void cloneUsesGeneratedCodeAndCopiesPermissionsOnlyWhenRequested() throws Exception {
        String token = login("owner.access");
        Role sourceReference = roleRepository.findByCode("RECEPTIONIST").orElseThrow();
        Role source = roleRepository.findDetailById(sourceReference.getId()).orElseThrow();

        JsonNode copied = objectMapper.readTree(mockMvc.perform(post("/api/access/roles/{roleId}/clone", source.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "displayName":"Bản sao tiếp nhận",
                      "copyPermissions":true,
                      "reason":"Create a safe custom variant"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code", matchesPattern("CUSTOM_ROLE_[0-9]{6,}")))
            .andExpect(jsonPath("$.system").value(false))
            .andExpect(jsonPath("$.permissionCount").value(source.getPermissions().size()))
            .andReturn().getResponse().getContentAsByteArray());

        JsonNode blank = objectMapper.readTree(mockMvc.perform(post("/api/access/roles/{roleId}/clone", source.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "displayName":"Bản sao trống",
                      "copyPermissions":false,
                      "reason":"Start with no default permissions"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.permissionCount").value(0))
            .andReturn().getResponse().getContentAsByteArray());

        org.junit.jupiter.api.Assertions.assertNotEquals(copied.path("code").asText(), blank.path("code").asText());
    }

    @Test
    void inactiveRoleCannotBePermissionCopySourceAndSystemStatusCannotChange() throws Exception {
        String token = login("owner.access");
        JsonNode source = createRole(token, """
            {"displayName":"Nguồn tạm thời"}
            """);
        mockMvc.perform(patch("/api/access/roles/{roleId}/status", source.path("id").asLong())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"INACTIVE","version":%d,"reason":"No longer a copy source"}
                    """.formatted(source.path("version").asLong())))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/access/roles")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"displayName":"Không hợp lệ","copyPermissionsFromRoleId":%d}
                    """.formatted(source.path("id").asLong())))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("ROLE_INACTIVE"));

        Role owner = roleRepository.findByCode("OWNER").orElseThrow();
        mockMvc.perform(patch("/api/access/roles/{roleId}/status", owner.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"INACTIVE","version":%d,"reason":"Unsafe"}
                    """.formatted(owner.getVersion())))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.errorCode").value("SYSTEM_ROLE_PROTECTED"));
    }

    @Test
    void roleAuditCanBeFilteredByTargetId() throws Exception {
        String token = login("owner.access");
        JsonNode first = createRole(token, "{\"displayName\":\"Vai trò thứ nhất\"}");
        createRole(token, "{\"displayName\":\"Vai trò thứ hai\"}");

        mockMvc.perform(get("/api/access/audit")
                .param("targetType", "ROLE")
                .param("targetId", first.path("id").asText())
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[*].targetId").value(org.hamcrest.Matchers.everyItem(
                org.hamcrest.Matchers.is(first.path("id").asInt()))));
    }

    @Test
    void roleUpdatePermissionDoesNotImplicitlyGrantStatusChanges() throws Exception {
        String ownerToken = login("owner.access");
        JsonNode target = createRole(ownerToken, "{\"displayName\":\"Target role\"}");
        JsonNode editorRole = createRole(ownerToken, "{\"displayName\":\"Metadata editor\"}");
        JsonNode editorMatrix = objectMapper.readTree(mockMvc.perform(put(
                "/api/access/roles/{roleId}/permissions", editorRole.path("id").asLong())
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "permissionCodes":["access.role.read","access.role.update"],
                      "version":%d,
                      "reason":"Metadata-only role administration"
                    }
                    """.formatted(editorRole.path("version").asLong())))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsByteArray());
        Role editor = roleRepository.findById(editorMatrix.path("role").path("id").asLong()).orElseThrow();
        Branch branch = branchRepository.findAll().stream()
            .filter(item -> item.getCode().equals("ACCESS")).findFirst().orElseThrow();
        createUser("role.editor", "Role Editor", editor, branch);
        String editorToken = login("role.editor");

        JsonNode updated = objectMapper.readTree(mockMvc.perform(put(
                "/api/access/roles/{roleId}", target.path("id").asLong())
                .header("Authorization", "Bearer " + editorToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "displayName":"Target role renamed",
                      "description":"Metadata change only",
                      "status":"ACTIVE",
                      "version":%d
                    }
                    """.formatted(target.path("version").asLong())))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsByteArray());

        mockMvc.perform(put("/api/access/roles/{roleId}", target.path("id").asLong())
                .header("Authorization", "Bearer " + editorToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "displayName":"Target role renamed",
                      "description":"Attempted status escalation",
                      "status":"INACTIVE",
                      "version":%d
                    }
                    """.formatted(updated.path("version").asLong())))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    @Test
    void concurrentRoleCreationGeneratesUniqueCodes() throws Exception {
        String token = login("owner.access");
        int count = 6;
        CountDownLatch start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(count);
        try {
            List<Future<String>> futures = IntStream.range(0, count)
                .mapToObj(index -> executor.submit(() -> {
                    start.await();
                    JsonNode created = createRole(token, """
                        {"displayName":"Concurrent role %d"}
                        """.formatted(index));
                    return created.path("code").asText();
                }))
                .toList();
            start.countDown();
            Set<String> codes = new java.util.HashSet<>();
            for (Future<String> future : futures) codes.add(future.get());
            org.junit.jupiter.api.Assertions.assertEquals(count, codes.size());
            org.junit.jupiter.api.Assertions.assertTrue(codes.stream()
                .allMatch(code -> code.matches("CUSTOM_ROLE_[0-9]{6,}")));
        } finally {
            executor.shutdownNow();
        }
    }

    private void createUser(String username, String displayName, Role role, Branch branch) {
        UserAccount account = new UserAccount(username, passwordEncoder.encode(PASSWORD), displayName, branch);
        account.addRole(role);
        account = userRepository.saveAndFlush(account);
        account.assignBranch(branch, true);
        userRepository.saveAndFlush(account);
    }

    private String login(String username) throws Exception {
        JsonNode body = objectMapper.readTree(mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"username":"%s","password":"%s"}
                    """.formatted(username, PASSWORD)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsByteArray());
        return body.path("accessToken").asText();
    }

    private JsonNode createRole(String token, String body) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/access/roles")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsByteArray());
    }
}
