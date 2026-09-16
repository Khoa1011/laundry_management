export type RealtimeConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline'

export interface RealtimeEvent {
  eventId: string
  eventType?: string
  type?: string
  branchId?: number | null
  entityId?: number | null
  entityCode?: string | null
  version?: number | null
  occurredAt?: string
  /** Feature payloads remain opaque to the transport and are decoded by subscribers. */
  notification?: unknown
  notificationId?: number | null
  unreadCount?: number | null
  serverTime?: string
}
