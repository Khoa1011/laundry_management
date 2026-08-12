# Notification SSE

## Authentication and isolation

`GET /api/notifications/stream` is an authenticated current-user endpoint protected by `notification.read-own`. Native `EventSource` is not used because it cannot attach the existing bearer header. The frontend opens the stream with `fetch`, `Accept: text/event-stream`, and `Authorization: Bearer ...`.

Tokens are never placed in URLs or query parameters. The backend resolves the principal from the bearer token and registers only that user ID. Emitter timeout is capped by the token's remaining lifetime. Employee account locking publishes an after-commit security event that closes active streams for the locked user.

## Events

The server emits:

- `connected`
- `notification.created`
- `notification.read`
- `notification.dismissed`
- `notification.unread-count`
- `heartbeat`

Every payload has an `eventId`, event type, server time, optional notification, optional notification ID, and optional unread count. Payloads use the same safe notification DTO returned by REST.

## Lifecycle

- The registry allows at most three active connections per user.
- A fourth connection replaces the oldest one. The browser frontend coordinates tabs so normal same-browser use keeps one active stream per signed-in user.
- Completion, timeout, error, and send failure remove the emitter.
- Heartbeat runs every 25 seconds by default and performs no database query.
- Emitter lifetime is at most 15 minutes and never exceeds the bearer token's remaining lifetime.
- Logout aborts the frontend fetch. Authentication expiry closes the server emitter and the reconnect path refreshes the session.
- The production Nginx frontend has an exact `/api/notifications/stream` proxy location with buffering/cache disabled and a long read timeout so event chunks are flushed immediately.

Actuator/Micrometer records active connections, active users, and failed sends without notification metadata.

## Reconnect and REST recovery

The application-level `NotificationProvider` owns one stream leader per browser/user. The leader opens SSE; follower tabs receive the same payloads through `BroadcastChannel("laundry-notifications")`. A localStorage lease is renewed while the leader is alive. If that lease expires, a follower tab takes over and opens a new stream.

Temporary failure uses exponential backoff from one second to 30 seconds. Offline browsers pause retry; the `online` event attempts leader election and reconnects. `401` and `403` stop the stream and are broadcast to sibling tabs so they do not loop on a non-retryable auth or permission failure. Network failures, `408`, `429`, and `5xx` remain retryable.

After a successful connection the provider invalidates unread count and notification queries. It merges a new event into the recent list immediately, while REST remains authoritative for full reconciliation. Existing content remains visible during reconnect.

Processed event IDs are kept in a bounded 240-entry set. Duplicate SSE events do not insert another item, animate the bell, show another toast, or replay sound.

## Multiple tabs

Tabs use `BroadcastChannel("laundry-notifications")` when available to share SSE payloads, unread count, connection state, and effect event IDs. Audio leadership uses a short-lived localStorage claim and prefers the visible focused tab. Browsers without BroadcastChannel fall back to per-tab SSE, bounded local event sets, and the same localStorage audio claim.

## Troubleshooting

- `401`: refresh or sign in again; verify no token appears in the request URL.
- `403`: verify `notification.read-own` is in the backend effective permission set and not denied.
- Repeated reconnect: inspect bearer expiry, reverse-proxy buffering/timeouts, and `/actuator/health`.
- Notification exists but no realtime event: REST is authoritative; inspect active connection metrics and failed-send count.
- Duplicate visuals or audio: inspect event IDs, provider count, and BroadcastChannel availability.

This implementation does not replay server history through `Last-Event-ID`. Reconnect recovery intentionally uses REST in v1.
