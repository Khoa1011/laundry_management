package com.laundry.management.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import com.laundry.management.auth.security.permission.PermissionCodes;
import java.util.Set;
import org.junit.jupiter.api.Test;

class RealtimeTopicResolverTest {
    private final RealtimeTopicResolver resolver = new RealtimeTopicResolver();

    @Test
    void resolvesOnlyTopicsBackedByEffectivePermissions() {
        assertThat(resolver.resolve(Set.of(PermissionCodes.NOTIFICATION_READ_OWN)))
            .containsExactly(RealtimeTopic.NOTIFICATION.value());
        assertThat(resolver.resolve(Set.of(PermissionCodes.ORDER_READ)))
            .containsExactly(RealtimeTopic.ORDER.value());
        assertThat(resolver.resolve(Set.of("customer.read"))).isEmpty();
    }

    @Test
    void keepsNotificationAndOrderTopicPermissionsIndependent() {
        assertThat(resolver.resolve(Set.of(PermissionCodes.NOTIFICATION_READ_OWN)))
            .doesNotContain(RealtimeTopic.ORDER.value());
        assertThat(resolver.resolve(Set.of(PermissionCodes.ORDER_READ)))
            .doesNotContain(RealtimeTopic.NOTIFICATION.value());
    }
}
