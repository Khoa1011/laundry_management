package com.laundry.management.notification.infrastructure;

import com.laundry.management.notification.domain.Notification;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    Optional<Notification> findByDeduplicationKey(String deduplicationKey);
}
