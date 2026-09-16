package com.laundry.management.realtime;

import com.laundry.management.auth.security.AuthenticatedUser;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component
public class RealtimeTopicResolver {

    public Set<String> resolve(Set<String> effectivePermissions) {
        return Arrays.stream(RealtimeTopic.values())
            .filter(topic -> effectivePermissions.contains(topic.requiredPermission()))
            .map(RealtimeTopic::value)
            .collect(Collectors.toUnmodifiableSet());
    }

    public boolean hasAny(Authentication authentication) {
        return authentication != null
            && authentication.isAuthenticated()
            && authentication.getPrincipal() instanceof AuthenticatedUser user
            && !resolve(user.permissions()).isEmpty();
    }
}
