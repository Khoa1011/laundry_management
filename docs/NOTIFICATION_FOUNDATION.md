# Notification Foundation

## Architecture

Notification Foundation is the shared internal platform for Employee and future order, inventory, payment, finance, delivery, machine, and complaint events.

```text
Business transaction
-> domain event
-> AFTER_COMMIT listener
-> NotificationApplicationService
-> REQUIRES_NEW persistence
-> notification + recipient commit
-> AFTER_COMMIT realtime event
-> user-scoped SSE
```

The business transaction is primary. Notification persistence or SSE failure never rolls back a committed business action. REST is the source of truth; SSE provides immediate delivery.

## Data model

- `notifications` stores content keys, safe fallback text, bounded metadata, actor, branch, audience, internal deep link, reference, deduplication key, expiry, and creation context.
- `notification_recipients` materializes each final `user_id` and owns delivered, seen, read, and dismissed timestamps.
- `notification_preferences` stores one user's sound key, volume, sound/toast flags, bell-animation flag, and optimistic version.

`UNIQUE(notification_id, user_id)` prevents duplicate recipients. `deduplication_key` prevents duplicate business events. Dismissal never deletes the shared notification.

## Recipient strategies

Supported audiences:

- `SPECIFIC_USERS`
- `SPECIFIC_EMPLOYEES`
- `ALL_ACTIVE_USERS_IN_BRANCH`
- `ALL_ACTIVE_EMPLOYEES_IN_BRANCH`
- `USERS_BY_POSITION_IN_BRANCH`
- `USERS_BY_PERMISSION_IN_BRANCH`

Each strategy returns candidate user IDs. A common validation pipeline then requires ACTIVE and unlocked users, branch membership, deduplicates IDs, and removes the actor when `excludeActor=true`.

Employee audiences require an ACTIVE employee, active branch assignment, linked ACTIVE user, and unlocked account. Employees without a login account produce no recipient. Position remains an HR function and never grants access.

Effective-permission resolution uses role grants and active user ALLOW overrides, then removes active DENY overrides. `DENY > ALLOW > ROLE`.

## Content safety

Notification content uses translation keys plus plain structured metadata. Metadata is limited to 8 KiB, four nesting levels, 40 fields per object, 50 items per list, and 500 characters per string. HTML markers, script routes, secret/token fields, salary, compensation, full identity values, document content, storage keys, and checksums are rejected.

Deep links are allowlisted internal routes. The frontend independently resolves known reference types and does not navigate to arbitrary metadata URLs.

## REST API

All paths require bearer authentication and generated permissions:

```http
GET   /api/notifications
GET   /api/notifications/{notificationId}
GET   /api/notifications/unread-count
PATCH /api/notifications/{notificationId}/read
PATCH /api/notifications/read-all
PATCH /api/notifications/{notificationId}/dismiss
GET   /api/notifications/preferences
PUT   /api/notifications/preferences
GET   /api/notifications/stream
POST  /api/notifications
```

The list supports `page`, `size` up to 50, `status`, `type`, `severity`, `branchId`, and `referenceType`, ordered by newest notification then ID. Normal lists exclude dismissed and expired records.

The send API chooses the exact permission from the audience type, validates actor and branch scope, and never exposes a system-wide broadcast audience.

## Adding an event

Business modules publish a small domain event inside their transaction. An `AFTER_COMMIT` listener builds a command and delegates to the same foundation:

```java
notificationService.notify(
    CreateNotificationCommand.builder()
        .type(NotificationType.EMPLOYEE_BRANCH_CHANGED)
        .severity(NotificationSeverity.INFO)
        .titleKey("notification.employeeBranchChanged.title")
        .messageKey("notification.employeeBranchChanged.message")
        .titleFallback("Chi nhánh làm việc đã thay đổi")
        .messageFallback("Phân công chi nhánh làm việc của bạn vừa được cập nhật.")
        .metadata(Map.of("employeeName", employeeName, "branchName", branchName))
        .audienceType(NotificationAudienceType.SPECIFIC_EMPLOYEES)
        .targetEmployeeIds(Set.of(employeeId))
        .branchId(branchId)
        .actorUserId(currentUserId)
        .excludeActor(true)
        .referenceType(NotificationReferenceType.EMPLOYEE)
        .referenceId(employeeId.toString())
        .deepLink("/employees/" + employeeId)
        .deduplicationKey("EMPLOYEE_BRANCH_CHANGED:" + employeeId + ":" + employeeVersion)
        .createdBySystem(true)
        .build()
);
```

New audience strategies implement `NotificationAudienceResolver` and register their enum type. `NotificationApplicationService` does not need to change.

## Current limitations

Version 1 is single-instance and has no transactional outbox. A process failure between business commit and notification persistence can lose the side effect. A future outbox can consume the existing domain events; Redis or a broker can replace only the realtime dispatcher/connection registry without changing recipient ownership or REST contracts.
