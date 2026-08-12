package com.laundry.management.employee;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.laundry.management.auth.domain.*;
import com.laundry.management.auth.infrastructure.*;
import com.laundry.management.employee.infrastructure.*;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class EmployeeSensitiveDataIntegrationTest {
    private static final String PASSWORD = "sensitive-integration-password";
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired BranchRepository branchRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired UserAccountRepository userRepository;
    @Autowired EmployeePositionRepository positionRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private Branch branchA;
    private Branch branchB;
    private Long positionId;
    private String ownerToken;
    private String managerToken;

    @BeforeEach
    void setUp() throws Exception {
        jdbc.update("delete from employee_documents");
        jdbc.update("delete from employee_identities");
        jdbc.update("delete from employee_compensations");
        jdbc.update("delete from employee_audit_logs");
        jdbc.update("delete from employee_branches");
        jdbc.update("delete from employees");
        jdbc.update("delete from authorization_audit_logs");
        jdbc.update("delete from user_permission_overrides where user_id in (select id from users where username like 'sensitive.%')");
        jdbc.update("delete from user_roles where user_id in (select id from users where username like 'sensitive.%')");
        jdbc.update("delete from user_branches where user_id in (select id from users where username like 'sensitive.%')");
        jdbc.update("delete from users where username like 'sensitive.%'");
        jdbc.update("delete from branches where code in ('SA', 'SB')");
        branchA = branchRepository.save(new Branch("SA", "Sensitive branch A"));
        branchB = branchRepository.save(new Branch("SB", "Sensitive branch B"));
        createUser("sensitive.owner", "Sensitive Owner", roleRepository.findByCode("OWNER").orElseThrow(), branchA, branchB);
        createUser("sensitive.manager", "Sensitive Manager", roleRepository.findByCode("MANAGER").orElseThrow(), branchA);
        positionId = positionRepository.findByActiveTrueOrderBySortOrderAscNameViAscIdAsc().get(0).getId();
        ownerToken = login("sensitive.owner");
        managerToken = login("sensitive.manager");
    }

    @Test
    void compensationRequiresExactPermissionAndRejectsOverlappingEffectiveDates() throws Exception {
        long employeeId = createEmployee(ownerToken, "Compensation target", branchA.getId()).path("id").asLong();
        mockMvc.perform(post("/api/employees/{id}/compensation", employeeId)
                .header("Authorization", bearer(ownerToken)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"baseSalary\":12000000,\"currency\":\"VND\",\"effectiveFrom\":\"2026-07-01\",\"reason\":\"Initial agreement\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.baseSalary").value(12000000));

        mockMvc.perform(post("/api/employees/{id}/compensation", employeeId)
                .header("Authorization", bearer(ownerToken)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"baseSalary\":13000000,\"currency\":\"VND\",\"effectiveFrom\":\"2026-06-01\",\"reason\":\"Invalid overlap\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("EMPLOYEE_COMPENSATION_PERIOD_CONFLICT"));

        mockMvc.perform(get("/api/employees/{id}/compensation", employeeId).header("Authorization", bearer(managerToken)))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/employees/{id}/compensation/history", employeeId).header("Authorization", bearer(ownerToken)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items", hasSize(1)));

        String auditJson = jdbc.queryForObject("select new_value from employee_audit_logs where action = 'COMPENSATION_UPDATED'", String.class);
        assertThat(auditJson).doesNotContain("12000000").doesNotContain("baseSalary");
    }

    @Test
    void identityIsEncryptedMaskedByDefaultAndFullRevealIsSeparatelyAuthorized() throws Exception {
        long employeeA = createEmployee(ownerToken, "Identity A", branchA.getId()).path("id").asLong();
        long employeeB = createEmployee(ownerToken, "Identity B", branchA.getId()).path("id").asLong();
        String request = "{\"identityType\":\"CITIZEN_ID\",\"number\":\"079203001234\",\"issuedDate\":\"2024-01-02\",\"issuedPlace\":\"Police\"}";
        mockMvc.perform(put("/api/employees/{id}/identity", employeeA)
                .header("Authorization", bearer(ownerToken)).contentType(MediaType.APPLICATION_JSON).content(request))
            .andExpect(status().isNoContent());

        String encrypted = jdbc.queryForObject("select encrypted_number from employee_identities where employee_id = ?", String.class, employeeA);
        assertThat(encrypted).startsWith("v1.").doesNotContain("079203001234");
        assertThat(jdbc.queryForObject("select number_hash from employee_identities where employee_id = ?", String.class, employeeA)).hasSize(64);

        mockMvc.perform(get("/api/employees/{id}/identity", employeeA).header("Authorization", bearer(ownerToken)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.number").value("********1234")).andExpect(jsonPath("$.masked").value(true));
        mockMvc.perform(get("/api/employees/{id}/identity", employeeA).param("reveal", "true").header("Authorization", bearer(ownerToken)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.number").value("079203001234")).andExpect(jsonPath("$.masked").value(false));
        mockMvc.perform(get("/api/employees/{id}/identity", employeeA).param("reveal", "true").header("Authorization", bearer(managerToken)))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/employees/{id}/identity", employeeA).header("Authorization", bearer(managerToken)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.number").value("********1234"));

        mockMvc.perform(put("/api/employees/{id}/identity", employeeB)
                .header("Authorization", bearer(ownerToken)).contentType(MediaType.APPLICATION_JSON).content(request))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("EMPLOYEE_IDENTITY_DUPLICATE"));
    }

    @Test
    void privateDocumentsValidateMagicBytesAndSeparateMetadataFromContentPermission() throws Exception {
        long employeeA = createEmployee(ownerToken, "Document A", branchA.getId()).path("id").asLong();
        long employeeB = createEmployee(ownerToken, "Document B", branchB.getId()).path("id").asLong();
        MockMultipartFile pdf = new MockMultipartFile("file", "contract.pdf", "application/pdf",
            "%PDF-1.4\nprivate test document".getBytes(StandardCharsets.US_ASCII));
        JsonNode uploaded = objectMapper.readTree(mockMvc.perform(multipart("/api/employees/{id}/documents", employeeA)
                .file(pdf).param("type", "CONTRACT").param("description", "Signed contract")
                .header("Authorization", bearer(ownerToken)))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.originalFilename").value("contract.pdf"))
            .andReturn().getResponse().getContentAsByteArray());

        mockMvc.perform(get("/api/employees/{id}/documents", employeeA).header("Authorization", bearer(managerToken)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items", hasSize(1)));
        mockMvc.perform(get("/api/employees/{id}/documents/{documentId}/content", employeeA, uploaded.path("id").asLong())
                .header("Authorization", bearer(managerToken)))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/employees/{id}/documents", employeeB).header("Authorization", bearer(managerToken)))
            .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/employees/{id}/documents/{documentId}/content", employeeA, uploaded.path("id").asLong())
                .header("Authorization", bearer(ownerToken)))
            .andExpect(status().isOk()).andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("inline")))
            .andExpect(content().bytes(pdf.getBytes()));
        assertThat(jdbc.queryForObject("select count(*) from employee_audit_logs where employee_id = ? and action = 'DOCUMENT_PREVIEWED'", Integer.class, employeeA)).isEqualTo(1);

        mockMvc.perform(get("/api/employees/{id}/documents/{documentId}/content", employeeA, uploaded.path("id").asLong())
                .param("download", "true").header("Authorization", bearer(ownerToken)))
            .andExpect(status().isOk()).andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment")));
        assertThat(jdbc.queryForObject("select count(*) from employee_audit_logs where employee_id = ? and action = 'DOCUMENT_DOWNLOADED'", Integer.class, employeeA)).isEqualTo(1);

        MockMultipartFile fakePdf = new MockMultipartFile("file", "fake.pdf", "application/pdf", "not a pdf".getBytes(StandardCharsets.US_ASCII));
        mockMvc.perform(multipart("/api/employees/{id}/documents", employeeA).file(fakePdf).param("type", "OTHER")
                .header("Authorization", bearer(ownerToken)))
            .andExpect(status().isUnsupportedMediaType()).andExpect(jsonPath("$.errorCode").value("EMPLOYEE_DOCUMENT_INVALID_FILE"));
    }

    private JsonNode createEmployee(String token, String fullName, Long branchId) throws Exception {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("fullName", fullName); body.put("phone", "0901234567"); body.put("email", fullName.replace(' ', '.').toLowerCase() + "@test.local");
        body.put("hireDate", "2026-07-01"); body.put("positionId", positionId); body.put("status", "ACTIVE");
        body.putArray("branchIds").add(branchId); body.put("primaryBranchId", branchId);
        return objectMapper.readTree(mockMvc.perform(post("/api/employees").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(body.toString()))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsByteArray());
    }

    private UserAccount createUser(String username, String displayName, Role role, Branch... branches) {
        UserAccount user = new UserAccount(username, passwordEncoder.encode(PASSWORD), displayName, branches[0]);
        user.addRole(role); user = userRepository.saveAndFlush(user);
        for (int index = 0; index < branches.length; index++) user.assignBranch(branches[index], index == 0);
        return userRepository.saveAndFlush(user);
    }
    private String login(String username) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"password\":\"" + PASSWORD + "\"}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).path("accessToken").asText();
    }
    private String bearer(String token) { return "Bearer " + token; }
}
