package com.laundry.management.auth.access.application;

import com.laundry.management.auth.domain.AccountStatus;
import com.laundry.management.auth.domain.Permission;
import com.laundry.management.auth.domain.PermissionOverrideEffect;
import com.laundry.management.auth.domain.PermissionStatus;
import com.laundry.management.auth.domain.Role;
import com.laundry.management.auth.domain.RoleStatus;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.domain.UserPermissionOverride;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EffectivePermissionService {

    private final UserAccountRepository userRepository;
    private final Clock clock;

    @Autowired
    public EffectivePermissionService(UserAccountRepository userRepository) {
        this(userRepository, Clock.systemUTC());
    }

    EffectivePermissionService(UserAccountRepository userRepository, Clock clock) {
        this.userRepository = userRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public EffectiveAccess resolve(Long userId) {
        return resolve(userRepository.findAccessById(userId).orElseThrow(() -> new ApiException(
            HttpStatus.NOT_FOUND,
            ErrorCode.USER_ACCESS_NOT_FOUND,
            "User access not found",
            "The user does not exist or is outside your access scope."
        )));
    }

    public EffectiveAccess resolve(UserAccount user) {
        if (user.getStatus() != AccountStatus.ACTIVE || user.isLocked()) {
            return new EffectiveAccess(user.getAuthorizationVersion(), null, Set.of(), List.of());
        }
        Instant now = clock.instant();
        Role role = user.getRoles().stream()
            .filter(candidate -> candidate.getStatus() == RoleStatus.ACTIVE)
            .sorted(Comparator.comparing(Role::getId))
            .findFirst()
            .orElse(null);
        Map<String, PermissionDecision> decisions = new LinkedHashMap<>();
        if (role != null) {
            role.getPermissions().stream()
                .filter(permission -> permission.getStatus() == PermissionStatus.ACTIVE)
                .sorted(Comparator.comparing(Permission::getCode))
                .forEach(permission -> decisions.put(permission.getCode(), new PermissionDecision(
                    permission.getCode(), true, "ROLE", role.getCode(), false, null, null, null
                )));
        }
        List<UserPermissionOverride> activeOverrides = user.getPermissionOverrides().stream()
            .filter(override -> override.isEffectiveAt(now))
            .sorted(Comparator.comparing(override -> override.getPermission().getCode()))
            .toList();
        for (UserPermissionOverride override : activeOverrides) {
            Permission permission = override.getPermission();
            if (permission.getStatus() != PermissionStatus.ACTIVE) continue;
            boolean denied = override.getEffect() == PermissionOverrideEffect.DENY;
            decisions.put(permission.getCode(), new PermissionDecision(
                permission.getCode(),
                !denied,
                denied ? "USER_DENY" : "USER_ALLOW",
                role == null ? null : role.getCode(),
                denied && role != null && role.getPermissions().stream()
                    .anyMatch(candidate -> candidate.getCode().equals(permission.getCode())),
                override.getReason(),
                override.getEffectiveFrom(),
                override.getEffectiveTo()
            ));
        }
        Set<String> effective = new LinkedHashSet<>();
        decisions.values().stream()
            .filter(PermissionDecision::effective)
            .map(PermissionDecision::permissionCode)
            .forEach(effective::add);
        return new EffectiveAccess(
            user.getAuthorizationVersion(),
            role,
            Set.copyOf(effective),
            List.copyOf(new ArrayList<>(decisions.values()))
        );
    }

    public record EffectiveAccess(
        long authorizationVersion,
        Role primaryRole,
        Set<String> permissionCodes,
        List<PermissionDecision> decisions
    ) {
    }

    public record PermissionDecision(
        String permissionCode,
        boolean effective,
        String source,
        String roleCode,
        boolean overridesRole,
        String reason,
        Instant effectiveFrom,
        Instant effectiveTo
    ) {
    }
}
