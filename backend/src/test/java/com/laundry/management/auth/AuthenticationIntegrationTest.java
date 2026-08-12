package com.laundry.management.auth;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.Role;
import com.laundry.management.auth.domain.PermissionOverrideEffect;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.PermissionRepository;
import com.laundry.management.auth.infrastructure.RefreshTokenRepository;
import com.laundry.management.auth.infrastructure.RoleRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.customer.infrastructure.CustomerActivityRepository;
import com.laundry.management.customer.infrastructure.CustomerAddressRepository;
import com.laundry.management.customer.infrastructure.CustomerRepository;
import java.time.Instant;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class AuthenticationIntegrationTest {

    private static final String USERNAME = "manager.test";
    private static final String PASSWORD = "test-password-only";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserAccountRepository userAccountRepository;

    @Autowired
    private BranchRepository branchRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtEncoder jwtEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CustomerActivityRepository customerActivityRepository;

    @Autowired
    private CustomerAddressRepository customerAddressRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @BeforeEach
    void setUp() {
        customerActivityRepository.deleteAll();
        customerAddressRepository.deleteAll();
        customerRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userAccountRepository.deleteAll();
        branchRepository.deleteAll();

        Branch branch = branchRepository.save(new Branch("TEST", "Test branch"));
        Role manager = roleRepository.findByCode("MANAGER").orElseThrow();
        UserAccount account = new UserAccount(
            USERNAME,
            passwordEncoder.encode(PASSWORD),
            "Test Manager",
            branch
        );
        account.addRole(manager);
        account = userAccountRepository.saveAndFlush(account);
        account.assignBranch(branch, true);
        userAccountRepository.saveAndFlush(account);
    }

    @Test
    void loginReturnsTokenAndBranchScopedUserContext() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"username":"manager.test","password":"test-password-only"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.tokenType").value("Bearer"))
            .andExpect(jsonPath("$.expiresIn").value(3600))
            .andExpect(jsonPath("$.user.username").value(USERNAME))
            .andExpect(jsonPath("$.user.roles", hasItem("MANAGER")))
            .andExpect(jsonPath("$.user.permissions", hasItem("customer.read")))
            .andExpect(jsonPath("$.user.branches[0].code").value("TEST"))
            .andExpect(cookie().httpOnly("laundry_refresh", true))
            .andExpect(cookie().secure("laundry_refresh", false))
            .andExpect(header().string("Set-Cookie", containsString("SameSite=Strict")))
            .andExpect(header().string("Cache-Control", containsString("no-store")))
            .andExpect(content().string(not(containsString("passwordHash"))))
            .andExpect(content().string(not(containsString("refreshToken"))));
    }

    @Test
    void refreshRotatesTokenAndRejectsReusedFamily() throws Exception {
        MvcResult login = login();
        Cookie original = login.getResponse().getCookie("laundry_refresh");

        MvcResult refreshed = mockMvc.perform(post("/api/auth/refresh").cookie(original))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").isNotEmpty())
            .andExpect(cookie().httpOnly("laundry_refresh", true))
            .andReturn();
        Cookie replacement = refreshed.getResponse().getCookie("laundry_refresh");
        org.junit.jupiter.api.Assertions.assertNotEquals(original.getValue(), replacement.getValue());

        mockMvc.perform(post("/api/auth/refresh").cookie(original))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.detail").value("Sign in to continue."));
        mockMvc.perform(post("/api/auth/refresh").cookie(replacement))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesRefreshTokenAndClearsCookie() throws Exception {
        Cookie refreshCookie = login().getResponse().getCookie("laundry_refresh");

        mockMvc.perform(post("/api/auth/logout").cookie(refreshCookie))
            .andExpect(status().isNoContent())
            .andExpect(cookie().maxAge("laundry_refresh", 0));

        mockMvc.perform(post("/api/auth/refresh").cookie(refreshCookie))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void userDenyOverridesRoleGrant() throws Exception {
        UserAccount account = userAccountRepository.findByUsernameIgnoreCase(USERNAME).orElseThrow();
        account.overridePermission(
            permissionRepository.findByCode("customer.read").orElseThrow(),
            PermissionOverrideEffect.DENY
        );
        userAccountRepository.saveAndFlush(account);

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"username":"manager.test","password":"test-password-only"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.permissions", org.hamcrest.Matchers.not(hasItem("customer.read"))));
    }

    @Test
    void userAllowAddsPermissionMissingFromRole() throws Exception {
        Role receptionist = roleRepository.findByCode("RECEPTIONIST").orElseThrow();
        Branch branch = branchRepository.findAll().get(0);
        UserAccount account = new UserAccount(
            "reception.audit",
            passwordEncoder.encode(PASSWORD),
            "Reception Audit",
            branch
        );
        account.addRole(receptionist);
        account = userAccountRepository.saveAndFlush(account);
        account.assignBranch(branch, true);
        account.overridePermission(
            permissionRepository.findByCode("customer.audit.read").orElseThrow(),
            PermissionOverrideEffect.ALLOW
        );
        userAccountRepository.saveAndFlush(account);

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"username":"reception.audit","password":"test-password-only"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.permissions", hasItem("customer.audit.read")));
    }

    @Test
    void loginUsesGenericUnauthorizedResponseForBadCredentials() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"username":"manager.test","password":"wrong-password"}
                    """))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"))
            .andExpect(jsonPath("$.detail").value("The username or password is incorrect."));
    }

    @Test
    void protectedEndpointWithoutTokenUsesProblemDetails() throws Exception {
        mockMvc.perform(get("/api/customers"))
            .andExpect(status().isUnauthorized())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
    }

    @Test
    void invalidTokenIsRejectedWithoutLeakingDetails() throws Exception {
        mockMvc.perform(get("/api/customers")
                .header("Authorization", "Bearer not-a-valid-token"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"))
            .andExpect(jsonPath("$.detail").value("Sign in to continue."));
    }

    @Test
    void tokenWithUnexpectedIssuerIsRejected() throws Exception {
        UserAccount account = userAccountRepository.findByUsernameIgnoreCase(USERNAME).orElseThrow();
        Instant issuedAt = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer("another-system")
            .issuedAt(issuedAt)
            .expiresAt(issuedAt.plusSeconds(300))
            .subject(USERNAME)
            .claim("userId", account.getId())
            .build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(
            JwsHeader.with(MacAlgorithm.HS256).build(),
            claims
        )).getTokenValue();

        mockMvc.perform(get("/api/customers")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
    }

    @Test
    void existingTokenIsRejectedAfterAccountDeactivation() throws Exception {
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"username":"manager.test","password":"test-password-only"}
                    """))
            .andExpect(status().isOk())
            .andReturn();
        JsonNode body = objectMapper.readTree(loginResult.getResponse().getContentAsByteArray());
        String token = body.path("accessToken").asText();

        UserAccount account = userAccountRepository.findByUsernameIgnoreCase(USERNAME).orElseThrow();
        account.deactivate();
        userAccountRepository.saveAndFlush(account);

        mockMvc.perform(get("/api/customers")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
    }

    private MvcResult login() throws Exception {
        return mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"username":"manager.test","password":"test-password-only"}
                    """))
            .andExpect(status().isOk())
            .andReturn();
    }
}
