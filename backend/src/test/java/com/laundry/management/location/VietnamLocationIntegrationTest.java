package com.laundry.management.location;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.Permission;
import com.laundry.management.auth.domain.PermissionOverrideEffect;
import com.laundry.management.auth.domain.Role;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.PermissionRepository;
import com.laundry.management.auth.infrastructure.RoleRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.location.api.LocationDtos;
import com.laundry.management.location.domain.AdministrativeVersion;
import com.laundry.management.location.infrastructure.VietnamProvinceApiClient;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class VietnamLocationIntegrationTest {

    private static final String PASSWORD = "integration-test-password";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserAccountRepository userRepository;

    @Autowired
    private BranchRepository branchRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @MockitoBean
    private VietnamProvinceApiClient apiClient;

    private UserAccount receptionist;
    private UserAccount directGrantUser;

    @BeforeEach
    void setUp() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Branch branch = branchRepository.save(new Branch("LOC" + suffix, "Chi nhánh địa chỉ"));
        Role receptionistRole = roleRepository.findByCode("RECEPTIONIST").orElseThrow();
        receptionist = account("location.reception." + suffix, "Location Reception", branch);
        receptionist.addRole(receptionistRole);
        receptionist = saveWithBranch(receptionist, branch);

        directGrantUser = saveWithBranch(account(
            "location.direct." + suffix,
            "Location Direct",
            branch
        ), branch);
        when(apiClient.provinces(AdministrativeVersion.V2)).thenReturn(List.of(
            new LocationDtos.DivisionResponse(79, "Thành phố Hồ Chí Minh", "thành phố trung ương")
        ));
    }

    @Test
    void endpointRequiresAuthenticationAndHonorsRoleAllowAndUserDeny() throws Exception {
        mockMvc.perform(get("/api/locations/vietnam/v2/provinces"))
            .andExpect(status().isUnauthorized());

        String allowedToken = login(receptionist.getUsername());
        mockMvc.perform(get("/api/locations/vietnam/v2/provinces")
                .header("Authorization", bearer(allowedToken)))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Location-Cache", "MISS"))
            .andExpect(jsonPath("$[0].code").value(79));

        Permission permission = permissionRepository.findByCode(PermissionCodes.LOCATION_READ).orElseThrow();
        receptionist.overridePermission(permission, PermissionOverrideEffect.DENY);
        userRepository.saveAndFlush(receptionist);

        mockMvc.perform(get("/api/locations/vietnam/v2/provinces")
                .header("Authorization", bearer(login(receptionist.getUsername()))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    @Test
    void directUserAllowGrantsCatalogWithoutRolePermission() throws Exception {
        Permission permission = permissionRepository.findByCode(PermissionCodes.LOCATION_READ).orElseThrow();
        directGrantUser.overridePermission(permission, PermissionOverrideEffect.ALLOW);
        userRepository.saveAndFlush(directGrantUser);

        mockMvc.perform(get("/api/locations/vietnam/v2/provinces")
                .header("Authorization", bearer(login(directGrantUser.getUsername()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("Thành phố Hồ Chí Minh"));
    }

    private UserAccount account(String username, String displayName, Branch branch) {
        UserAccount account = new UserAccount(
            username,
            passwordEncoder.encode(PASSWORD),
            displayName,
            branch
        );
        return account;
    }

    private UserAccount saveWithBranch(UserAccount account, Branch branch) {
        UserAccount saved = userRepository.saveAndFlush(account);
        saved.assignBranch(branch, true);
        return userRepository.saveAndFlush(saved);
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

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
