package com.laundry.management.notification.infrastructure;

import com.laundry.management.notification.domain.NotificationPreference;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, Long> {
    Optional<NotificationPreference> findByUserId(Long userId);
}
