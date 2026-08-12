package com.laundry.management.notification;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.PermissionOverrideEffect;
import com.laundry.management.auth.domain.Role;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.PermissionRepository;
import com.laundry.management.auth.infrastructure.RoleRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.employee.domain.Employee;
import com.laundry.management.employee.domain.EmployeeBranch;
import com.laundry.management.employee.domain.EmployeePosition;
import com.laundry.management.employee.domain.EmployeeStatus;
import com.laundry.management.employee.infrastructure.EmployeeBranchRepository;
import com.laundry.management.employee.infrastructure.EmployeePositionRepository;
import com.laundry.management.employee.infrastructure.EmployeeRepository;
import com.laundry.management.notification.infrastructure.NotificationPreferenceRepository;
import com.laundry.management.notification.infrastructure.NotificationRecipientRepository;
import com.laundry.management.notification.infrastructure.NotificationRepository;
import com.laundry.management.notification.application.CreateNotificationCommand;
import com.laundry.management.notification.application.NotificationApplicationService;
import com.laundry.management.notification.api.NotificationDtos;
import com.laundry.management.notification.domain.NotificationAudienceType;
import com.laundry.management.notification.domain.NotificationSeverity;
import com.laundry.management.notification.domain.NotificationType;
import com.laundry.management.notification.realtime.NotificationConnectionRegistry;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
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
class NotificationIntegrationTest {
    private static final String PASSWORD = "notification-test-only";
    private static final AtomicInteger SEQUENCE = new AtomicInteger();

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired UserAccountRepository userRepository;
    @Autowired BranchRepository branchRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired PermissionRepository permissionRepository;
    @Autowired EmployeeRepository employeeRepository;
    @Autowired EmployeeBranchRepository employeeBranchRepository;
    @Autowired EmployeePositionRepository positionRepository;
    @Autowired NotificationRecipientRepository recipientRepository;
    @Autowired NotificationPreferenceRepository preferenceRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired NotificationConnectionRegistry connectionRegistry;
    @Autowired NotificationApplicationService notificationService;

    private Branch branch;
    private UserAccount owner;
    private UserAccount recipient;
    private UserAccount unrelated;

    @BeforeEach
    void setUp() {
        recipientRepository.deleteAll();
        preferenceRepository.deleteAll();
        notificationRepository.deleteAll();
        int suffix = SEQUENCE.incrementAndGet();
        branch = branchRepository.saveAndFlush(new Branch("NOTIFY" + suffix, "Notification branch " + suffix));
        owner = createUser("notify.owner." + suffix, "Notification Owner", "OWNER", branch);
        recipient = createUser("notify.recipient." + suffix, "Notification Recipient", "RECEPTIONIST", branch);
        unrelated = createUser("notify.unrelated." + suffix, "Notification Unrelated", "RECEPTIONIST", branch);
    }

    @Test
    void specificUserNotificationExcludesActorAndEnforcesRecipientOwnership() throws Exception {
        String ownerToken = login(owner.getUsername());
        JsonNode sent = send(ownerToken, """
            {
              "type":"GENERIC_INTERNAL",
              "severity":"INFO",
              "titleKey":"notification.generic.title",
              "messageKey":"notification.generic.message",
              "titleFallback":"Test notification",
              "messageFallback":"Recipient only",
              "metadata":{"employeeName":"Safe name"},
              "audienceType":"SPECIFIC_USERS",
              "targetUserIds":[%d,%d,%d],
              "branchId":%d,
              "excludeActor":true,
              "deduplicationKey":"TEST:SPECIFIC:%d"
            }
            """.formatted(owner.getId(), recipient.getId(), recipient.getId(), branch.getId(), recipient.getId()));

        long notificationId = sent.path("notificationId").asLong();
        org.assertj.core.api.Assertions.assertThat(sent.path("recipientCount").asInt()).isEqualTo(1);

        mockMvc.perform(get("/api/notifications").header("Authorization", bearer(login(recipient.getUsername()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(1))
            .andExpect(jsonPath("$.content[0].id").value(notificationId))
            .andExpect(jsonPath("$.unreadCount").value(1));
        mockMvc.perform(get("/api/notifications").header("Authorization", bearer(ownerToken)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(0));
        mockMvc.perform(get("/api/notifications").header("Authorization", bearer(login(unrelated.getUsername()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(0));
        mockMvc.perform(patch("/api/notifications/{id}/read", notificationId)
                .header("Authorization", bearer(ownerToken)))
            .andExpect(status().isNotFound());
        mockMvc.perform(patch("/api/notifications/{id}/read", notificationId)
                .header("Authorization", bearer(login(recipient.getUsername()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.unreadCount").value(0));
    }

    @Test
    void employeeAudienceSkipsEmployeeWithoutAccountAndLockedAccount() throws Exception {
        EmployeePosition position = positionRepository.findAll().stream().findFirst().orElseThrow();
        Employee linked = createEmployee("NV-NOTIFY-" + SEQUENCE.incrementAndGet(), recipient, position);
        Employee noAccount = createEmployee("NV-NOTIFY-" + SEQUENCE.incrementAndGet(), null, position);

        JsonNode first = send(login(owner.getUsername()), employeeAudienceBody(linked, noAccount, "EMPLOYEE:A"));
        org.assertj.core.api.Assertions.assertThat(first.path("recipientCount").asInt()).isEqualTo(1);

        recipient.lock("Notification test lock", owner);
        userRepository.saveAndFlush(recipient);
        JsonNode second = send(login(owner.getUsername()), employeeAudienceBody(linked, noAccount, "EMPLOYEE:B"));
        org.assertj.core.api.Assertions.assertThat(second.path("recipientCount").asInt()).isZero();
    }

    @Test
    void effectivePermissionAudienceHonorsUserDenyAndDeduplication() throws Exception {
        UserAccount allowed = createUser(
            "notify.allowed." + SEQUENCE.incrementAndGet(), "Allowed Manager", "MANAGER", branch
        );
        UserAccount denied = createUser(
            "notify.denied." + SEQUENCE.incrementAndGet(), "Denied Manager", "MANAGER", branch
        );
        denied.overridePermission(
            permissionRepository.findByCode("employee.read").orElseThrow(),
            PermissionOverrideEffect.DENY
        );
        userRepository.saveAndFlush(denied);

        String body = """
            {
              "type":"GENERIC_INTERNAL",
              "severity":"ACTION_REQUIRED",
              "titleKey":"notification.permission.title",
              "messageKey":"notification.permission.message",
              "titleFallback":"Permission workflow",
              "messageFallback":"Action required",
              "audienceType":"USERS_BY_PERMISSION_IN_BRANCH",
              "targetPermissionCode":"employee.read",
              "branchId":%d,
              "excludeActor":true,
              "deduplicationKey":"PERMISSION:%d"
            }
            """.formatted(branch.getId(), branch.getId());
        String token = login(owner.getUsername());
        JsonNode created = send(token, body);
        JsonNode duplicate = send(token, body);

        org.assertj.core.api.Assertions.assertThat(created.path("recipientCount").asInt()).isGreaterThanOrEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(duplicate.path("created").asBoolean()).isFalse();
        mockMvc.perform(get("/api/notifications").header("Authorization", bearer(login(allowed.getUsername()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(1));
        mockMvc.perform(get("/api/notifications").header("Authorization", bearer(login(denied.getUsername()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(0));
    }

    @Test
    void concurrentDeduplicationCreatesOneNotificationAndOneRecipient() throws Exception {
        String deduplicationKey = "CONCURRENT:" + SEQUENCE.incrementAndGet();
        CreateNotificationCommand command = CreateNotificationCommand.builder()
            .type(NotificationType.GENERIC_INTERNAL)
            .severity(NotificationSeverity.INFO)
            .titleKey("notification.concurrent.title")
            .messageKey("notification.concurrent.message")
            .titleFallback("Concurrent notification")
            .messageFallback("Created once")
            .audienceType(NotificationAudienceType.SPECIFIC_USERS)
            .targetUserIds(Set.of(recipient.getId()))
            .branchId(branch.getId())
            .excludeActor(true)
            .deduplicationKey(deduplicationKey)
            .createdBySystem(true)
            .build();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);

        try {
            List<Future<NotificationDtos.SendResponse>> futures = java.util.stream.IntStream.range(0, 2)
                .mapToObj(ignored -> executor.submit(() -> {
                    ready.countDown();
                    start.await();
                    return notificationService.notify(command);
                }))
                .toList();
            ready.await();
            start.countDown();
            List<NotificationDtos.SendResponse> responses = futures.stream().map(future -> {
                try {
                    return future.get();
                } catch (Exception exception) {
                    throw new RuntimeException(exception);
                }
            }).toList();

            org.assertj.core.api.Assertions.assertThat(
                responses.stream().filter(NotificationDtos.SendResponse::created).count()
            ).isEqualTo(1);
            org.assertj.core.api.Assertions.assertThat(
                responses.stream().map(NotificationDtos.SendResponse::notificationId).distinct().count()
            ).isEqualTo(1);
        } finally {
            executor.shutdownNow();
        }
        org.assertj.core.api.Assertions.assertThat(notificationRepository.count()).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(recipientRepository.count()).isEqualTo(1);
    }

    @Test
    void preferencesAreCurrentUserOnlyAndValidated() throws Exception {
        String token = login(recipient.getUsername());
        mockMvc.perform(get("/api/notifications/preferences").header("Authorization", bearer(token)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.soundKey").value("SOFT_CHIME"))
            .andExpect(jsonPath("$.soundVolume").value(65));
        mockMvc.perform(put("/api/notifications/preferences")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "soundEnabled":true,
                      "soundKey":"DIGITAL_PING",
                      "soundVolume":35,
                      "toastEnabled":false,
                      "bellAnimationEnabled":true
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.soundKey").value("DIGITAL_PING"))
            .andExpect(jsonPath("$.soundVolume").value(35));
        mockMvc.perform(put("/api/notifications/preferences")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "soundEnabled":true,
                      "soundKey":"SOFT_CHIME",
                      "soundVolume":101,
                      "toastEnabled":true,
                      "bellAnimationEnabled":true
                    }
                    """))
            .andExpect(status().isBadRequest());
    }

    @Test
    void streamRequiresBearerAuthenticationAndSendsConnectedEvent() throws Exception {
        mockMvc.perform(get("/api/notifications/stream").accept(MediaType.TEXT_EVENT_STREAM))
            .andExpect(status().isUnauthorized());

        String token = login(recipient.getUsername());
        MvcResult result = mockMvc.perform(get("/api/notifications/stream")
                .header("Authorization", bearer(token))
                .accept(MediaType.TEXT_EVENT_STREAM))
            .andExpect(request().asyncStarted())
            .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM))
            .andReturn();
        Thread.sleep(100);
        org.assertj.core.api.Assertions.assertThat(result.getResponse().getContentAsString())
            .contains("event:connected")
            .contains("\"eventType\":\"connected\"");
        org.assertj.core.api.Assertions.assertThat(connectionRegistry.activeConnectionCount(recipient.getId()))
            .isEqualTo(1);
        connectionRegistry.disconnectUser(recipient.getId());
    }

    @Test
    void committedEmployeeBranchChangeCreatesAndStreamsNotificationAfterCommit() throws Exception {
        Branch newBranch = branchRepository.saveAndFlush(new Branch(
            "NOTIFY-E2E-" + SEQUENCE.incrementAndGet(),
            "Notification E2E branch"
        ));
        owner.assignBranch(newBranch, false);
        recipient.assignBranch(newBranch, false);
        userRepository.saveAndFlush(owner);
        userRepository.saveAndFlush(recipient);
        EmployeePosition position = positionRepository.findAll().stream().findFirst().orElseThrow();
        Employee employee = createEmployee("NV-NOTIFY-" + SEQUENCE.incrementAndGet(), recipient, position);
        String recipientToken = login(recipient.getUsername());
        MvcResult stream = mockMvc.perform(get("/api/notifications/stream")
                .header("Authorization", bearer(recipientToken))
                .accept(MediaType.TEXT_EVENT_STREAM))
            .andExpect(request().asyncStarted())
            .andReturn();

        mockMvc.perform(post("/api/employees/{employeeId}/branches", employee.getId())
                .header("Authorization", bearer(login(owner.getUsername())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "branchId":%d,
                      "primary":false,
                      "version":%d
                    }
                    """.formatted(newBranch.getId(), employee.getVersion())))
            .andExpect(status().isOk());

        String streamBody = awaitStreamContains(stream, "event:notification.created");
        org.assertj.core.api.Assertions.assertThat(streamBody)
            .contains("\"eventType\":\"notification.created\"")
            .contains("\"type\":\"EMPLOYEE_BRANCH_CHANGED\"")
            .contains("\"unreadCount\":1");
        mockMvc.perform(get("/api/notifications").header("Authorization", bearer(recipientToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(1))
            .andExpect(jsonPath("$.content[0].referenceId").value(employee.getId().toString()))
            .andExpect(jsonPath("$.unreadCount").value(1));
        mockMvc.perform(get("/api/notifications")
                .header("Authorization", bearer(login(owner.getUsername()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(0));
        mockMvc.perform(get("/api/notifications")
                .header("Authorization", bearer(login(unrelated.getUsername()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(0));
        connectionRegistry.disconnectUser(recipient.getId());
    }

    @Test
    void branchEmployeeBroadcastIncludesOnlyEligibleEmployees() throws Exception {
        EmployeePosition position = positionRepository.findAll().stream().findFirst().orElseThrow();
        createEmployee("NV-NOTIFY-" + SEQUENCE.incrementAndGet(), recipient, position);
        Employee suspended = createEmployee(
            "NV-NOTIFY-" + SEQUENCE.incrementAndGet(), unrelated, position
        );
        suspended.changeStatus(EmployeeStatus.SUSPENDED, owner);
        employeeRepository.saveAndFlush(suspended);
        createEmployee("NV-NOTIFY-" + SEQUENCE.incrementAndGet(), null, position);

        JsonNode sent = send(login(owner.getUsername()), """
            {
              "type":"SYSTEM_ANNOUNCEMENT",
              "severity":"INFO",
              "titleKey":"notification.announcement.title",
              "messageKey":"notification.announcement.message",
              "titleFallback":"Branch announcement",
              "messageFallback":"Internal branch message",
              "audienceType":"ALL_ACTIVE_EMPLOYEES_IN_BRANCH",
              "branchId":%d,
              "excludeActor":true,
              "deduplicationKey":"ANNOUNCEMENT:%d"
            }
            """.formatted(branch.getId(), branch.getId()));

        org.assertj.core.api.Assertions.assertThat(sent.path("recipientCount").asInt()).isEqualTo(1);
        mockMvc.perform(get("/api/notifications")
                .header("Authorization", bearer(login(recipient.getUsername()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(1));
        mockMvc.perform(get("/api/notifications")
                .header("Authorization", bearer(login(unrelated.getUsername()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(0));
    }

    @Test
    void readAndDismissStateRemainIndependentPerRecipient() throws Exception {
        JsonNode sent = send(login(owner.getUsername()), """
            {
              "type":"GENERIC_INTERNAL",
              "severity":"INFO",
              "titleKey":"notification.state.title",
              "messageKey":"notification.state.message",
              "titleFallback":"Independent state",
              "messageFallback":"Per recipient state",
              "audienceType":"SPECIFIC_USERS",
              "targetUserIds":[%d,%d],
              "branchId":%d,
              "excludeActor":true,
              "deduplicationKey":"STATE:%d"
            }
            """.formatted(recipient.getId(), unrelated.getId(), branch.getId(), branch.getId()));
        long notificationId = sent.path("notificationId").asLong();
        String recipientToken = login(recipient.getUsername());

        mockMvc.perform(patch("/api/notifications/{id}/read", notificationId)
                .header("Authorization", bearer(recipientToken)))
            .andExpect(status().isOk());
        mockMvc.perform(patch("/api/notifications/{id}/dismiss", notificationId)
                .header("Authorization", bearer(recipientToken)))
            .andExpect(status().isOk());
        mockMvc.perform(get("/api/notifications").header("Authorization", bearer(recipientToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(0))
            .andExpect(jsonPath("$.unreadCount").value(0));
        mockMvc.perform(get("/api/notifications")
                .header("Authorization", bearer(login(unrelated.getUsername()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(1))
            .andExpect(jsonPath("$.content[0].unread").value(true))
            .andExpect(jsonPath("$.unreadCount").value(1));
    }

    @Test
    void sendRequiresExplicitActorExclusionExactPermissionAndBranchScope() throws Exception {
        String ownerToken = login(owner.getUsername());
        String recipientToken = login(recipient.getUsername());
        String withoutExclusion = """
            {
              "type":"GENERIC_INTERNAL",
              "severity":"INFO",
              "titleKey":"notification.test.title",
              "messageKey":"notification.test.message",
              "titleFallback":"Test",
              "messageFallback":"Test",
              "audienceType":"SPECIFIC_USERS",
              "targetUserIds":[%d],
              "branchId":%d
            }
            """.formatted(recipient.getId(), branch.getId());
        mockMvc.perform(post("/api/notifications")
                .header("Authorization", bearer(ownerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(withoutExclusion))
            .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/notifications")
                .header("Authorization", bearer(recipientToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(withoutExclusion.replace(
                    "\"branchId\":" + branch.getId(),
                    "\"branchId\":" + branch.getId() + ",\"excludeActor\":true"
                )))
            .andExpect(status().isForbidden());

        Branch externalBranch = branchRepository.saveAndFlush(new Branch(
            "NOTIFY-X-" + SEQUENCE.incrementAndGet(), "External notification branch"
        ));
        UserAccount external = createUser(
            "notify.external." + SEQUENCE.incrementAndGet(), "External Recipient", "RECEPTIONIST", externalBranch
        );
        mockMvc.perform(post("/api/notifications")
                .header("Authorization", bearer(ownerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "type":"GENERIC_INTERNAL",
                      "severity":"INFO",
                      "titleKey":"notification.test.title",
                      "messageKey":"notification.test.message",
                      "titleFallback":"Test",
                      "messageFallback":"Test",
                      "audienceType":"SPECIFIC_USERS",
                      "targetUserIds":[%d],
                      "branchId":%d,
                      "excludeActor":true
                    }
                    """.formatted(external.getId(), externalBranch.getId())))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.errorCode").value("NOTIFICATION_SCOPE_DENIED"));
    }

    @Test
    void sendRejectsSensitiveMetadataAndUnknownAudienceTargets() throws Exception {
        String token = login(owner.getUsername());
        mockMvc.perform(post("/api/notifications")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "type":"GENERIC_INTERNAL",
                      "severity":"INFO",
                      "titleKey":"notification.test.title",
                      "messageKey":"notification.test.message",
                      "titleFallback":"Test",
                      "messageFallback":"Test",
                      "metadata":{"salary":"1000000"},
                      "audienceType":"SPECIFIC_USERS",
                      "targetUserIds":[%d],
                      "branchId":%d,
                      "excludeActor":true
                    }
                    """.formatted(recipient.getId(), branch.getId())))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errorCode").value("NOTIFICATION_CONTENT_INVALID"));

        mockMvc.perform(post("/api/notifications")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "type":"GENERIC_INTERNAL",
                      "severity":"INFO",
                      "titleKey":"notification.test.title",
                      "messageKey":"notification.test.message",
                      "titleFallback":"Test",
                      "messageFallback":"Test",
                      "audienceType":"USERS_BY_PERMISSION_IN_BRANCH",
                      "targetPermissionCode":"unknown.permission",
                      "branchId":%d,
                      "excludeActor":true
                    }
                    """.formatted(branch.getId())))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errorCode").value("NOTIFICATION_TARGET_INVALID"));

        mockMvc.perform(post("/api/notifications")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "type":"GENERIC_INTERNAL",
                      "severity":"INFO",
                      "titleKey":"notification.test.title",
                      "messageKey":"notification.test.message",
                      "titleFallback":"Test",
                      "messageFallback":"Test",
                      "audienceType":"USERS_BY_POSITION_IN_BRANCH",
                      "targetPositionIds":[999999999],
                      "branchId":%d,
                      "excludeActor":true
                    }
                    """.formatted(branch.getId())))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errorCode").value("NOTIFICATION_TARGET_INVALID"));
    }

    private UserAccount createUser(String username, String displayName, String roleCode, Branch userBranch) {
        Role role = roleRepository.findByCode(roleCode).orElseThrow();
        UserAccount account = new UserAccount(
            username, passwordEncoder.encode(PASSWORD), displayName, userBranch
        );
        account.addRole(role);
        account = userRepository.saveAndFlush(account);
        account.assignBranch(userBranch, true);
        return userRepository.saveAndFlush(account);
    }

    private Employee createEmployee(String code, UserAccount linkedUser, EmployeePosition position) {
        Employee employee = new Employee(
            code,
            "Notification Employee " + code,
            "0900000000",
            "84900000000",
            null,
            LocalDate.of(1990, 1, 1),
            null,
            LocalDate.of(2025, 1, 1),
            position,
            EmployeeStatus.ACTIVE,
            owner
        );
        if (linkedUser != null) employee.linkUser(linkedUser, owner);
        employee = employeeRepository.saveAndFlush(employee);
        employeeBranchRepository.saveAndFlush(new EmployeeBranch(
            employee, branch, true, owner, Instant.now()
        ));
        return employee;
    }

    private String employeeAudienceBody(Employee linked, Employee noAccount, String deduplicationKey) {
        return """
            {
              "type":"EMPLOYEE_BRANCH_CHANGED",
              "severity":"INFO",
              "titleKey":"notification.employeeBranchChanged.title",
              "messageKey":"notification.employeeBranchChanged.message",
              "titleFallback":"Branch changed",
              "messageFallback":"Your branch changed",
              "audienceType":"SPECIFIC_EMPLOYEES",
              "targetEmployeeIds":[%d,%d],
              "branchId":%d,
              "excludeActor":true,
              "referenceType":"EMPLOYEE",
              "referenceId":"%d",
              "deepLink":"/employees/%d",
              "deduplicationKey":"%s"
            }
            """.formatted(
            linked.getId(), noAccount.getId(), branch.getId(), linked.getId(), linked.getId(), deduplicationKey
        );
    }

    private JsonNode send(String token, String body) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/api/notifications")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsByteArray());
    }

    private String awaitStreamContains(MvcResult result, String expected) throws Exception {
        long deadline = System.currentTimeMillis() + 3_000;
        String body;
        do {
            body = result.getResponse().getContentAsString();
            if (body.contains(expected)) {
                return body;
            }
            Thread.sleep(25);
        } while (System.currentTimeMillis() < deadline);
        return body;
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
