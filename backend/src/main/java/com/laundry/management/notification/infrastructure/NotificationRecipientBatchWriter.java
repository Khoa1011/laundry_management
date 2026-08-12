package com.laundry.management.notification.infrastructure;

import java.util.Collection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class NotificationRecipientBatchWriter {
    private static final int BATCH_SIZE = 100;
    private final JdbcTemplate jdbcTemplate;

    public NotificationRecipientBatchWriter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void insert(Long notificationId, Collection<Long> userIds) {
        if (userIds.isEmpty()) {
            return;
        }
        jdbcTemplate.batchUpdate(
            "INSERT INTO notification_recipients (notification_id, user_id) VALUES (?, ?)",
            userIds,
            BATCH_SIZE,
            (statement, userId) -> {
                statement.setLong(1, notificationId);
                statement.setLong(2, userId);
            }
        );
    }
}
