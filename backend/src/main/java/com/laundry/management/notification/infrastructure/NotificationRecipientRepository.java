package com.laundry.management.notification.infrastructure;

import com.laundry.management.notification.domain.NotificationRecipient;
import com.laundry.management.notification.domain.NotificationReferenceType;
import com.laundry.management.notification.domain.NotificationSeverity;
import com.laundry.management.notification.domain.NotificationType;
import java.time.Instant;
import java.util.Optional;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRecipientRepository extends JpaRepository<NotificationRecipient, Long> {
    long countByNotificationId(Long notificationId);
    boolean existsByUserIdAndNotificationId(Long userId, Long notificationId);

    @EntityGraph(attributePaths = "notification")
    @Query("""
        select r from NotificationRecipient r
        join r.notification n
        where r.userId = :userId
          and r.dismissedAt is null
          and (n.expiresAt is null or n.expiresAt > :now)
          and (:status = 'ALL'
            or (:status = 'UNREAD' and r.readAt is null)
            or (:status = 'READ' and r.readAt is not null))
          and (:type is null or n.type = :type)
          and (:severity is null or n.severity = :severity)
          and (:branchId is null or n.branchId = :branchId)
          and (:referenceType is null or n.referenceType = :referenceType)
        order by r.createdAt desc, n.id desc
        """)
    Page<NotificationRecipient> findVisible(
        @Param("userId") Long userId,
        @Param("status") String status,
        @Param("type") NotificationType type,
        @Param("severity") NotificationSeverity severity,
        @Param("branchId") Long branchId,
        @Param("referenceType") NotificationReferenceType referenceType,
        @Param("now") Instant now,
        Pageable pageable
    );

    @EntityGraph(attributePaths = "notification")
    @Query("""
        select r from NotificationRecipient r
        join r.notification n
        where r.userId = :userId
          and n.id = :notificationId
          and r.dismissedAt is null
          and (n.expiresAt is null or n.expiresAt > :now)
        """)
    Optional<NotificationRecipient> findVisibleDetail(
        @Param("userId") Long userId,
        @Param("notificationId") Long notificationId,
        @Param("now") Instant now
    );

    @Query("""
        select count(r.id) from NotificationRecipient r
        join r.notification n
        where r.userId = :userId
          and r.readAt is null
          and r.dismissedAt is null
          and (n.expiresAt is null or n.expiresAt > :now)
        """)
    long countUnread(@Param("userId") Long userId, @Param("now") Instant now);

    @Query("""
        select r.userId, count(r.id) from NotificationRecipient r
        join r.notification n
        where r.userId in :userIds
          and r.readAt is null
          and r.dismissedAt is null
          and (n.expiresAt is null or n.expiresAt > :now)
        group by r.userId
        """)
    List<Object[]> countUnreadByUserIds(
        @Param("userIds") Collection<Long> userIds,
        @Param("now") Instant now
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        update NotificationRecipient r
        set r.readAt = :now, r.seenAt = coalesce(r.seenAt, :now)
        where r.userId = :userId
          and r.notification.id = :notificationId
          and r.dismissedAt is null
          and r.readAt is null
        """)
    int markRead(
        @Param("userId") Long userId,
        @Param("notificationId") Long notificationId,
        @Param("now") Instant now
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        update NotificationRecipient r
        set r.readAt = :now, r.seenAt = coalesce(r.seenAt, :now)
        where r.userId = :userId
          and r.dismissedAt is null
          and r.readAt is null
          and (r.notification.expiresAt is null or r.notification.expiresAt > :now)
        """)
    int markAllRead(@Param("userId") Long userId, @Param("now") Instant now);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        update NotificationRecipient r
        set r.dismissedAt = :now
        where r.userId = :userId
          and r.notification.id = :notificationId
          and r.dismissedAt is null
        """)
    int dismiss(
        @Param("userId") Long userId,
        @Param("notificationId") Long notificationId,
        @Param("now") Instant now
    );
}
