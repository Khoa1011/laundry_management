export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'ACTION_REQUIRED'
export type NotificationType =
  | 'EMPLOYEE_STATUS_CHANGED'
  | 'EMPLOYEE_BRANCH_CHANGED'
  | 'EMPLOYEE_ACCOUNT_LINKED'
  | 'EMPLOYEE_ACCOUNT_LOCKED'
  | 'SYSTEM_ANNOUNCEMENT'
  | 'GENERIC_INTERNAL'
export type NotificationReferenceType =
  | 'EMPLOYEE' | 'CUSTOMER' | 'ORDER' | 'INVENTORY' | 'PAYMENT'
  | 'FINANCE' | 'DELIVERY' | 'MACHINE' | 'COMPLAINT' | 'SYSTEM'
export type NotificationListStatus = 'ALL' | 'UNREAD' | 'READ'
export type NotificationSoundKey =
  | 'NONE' | 'SOFT_CHIME' | 'CLEAR_BELL' | 'DIGITAL_PING' | 'DOUBLE_TONE' | 'URGENT_ALERT'
export type NotificationConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline'

export interface NotificationItem {
  id: number
  type: NotificationType
  severity: NotificationSeverity
  titleKey: string
  messageKey: string
  titleFallback: string
  messageFallback: string
  metadata: Record<string, unknown>
  branchId: number | null
  referenceType: NotificationReferenceType | null
  referenceId: string | null
  deepLink: string | null
  createdAt: string
  readAt: string | null
  unread: boolean
}

export interface NotificationPage {
  content: NotificationItem[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
  unreadCount: number
}

export interface NotificationFilters {
  page?: number
  size?: number
  status?: NotificationListStatus
  type?: NotificationType
  severity?: NotificationSeverity
  branchId?: number
  referenceType?: NotificationReferenceType
}

export interface NotificationMutationResponse {
  notificationId: number | null
  updated: number
  unreadCount: number
}

export interface NotificationPreferences {
  soundEnabled: boolean
  soundKey: NotificationSoundKey
  soundVolume: number
  toastEnabled: boolean
  bellAnimationEnabled: boolean
  version: number
}

export interface NotificationSseEnvelope {
  eventId: string
  eventType: string
  notification: NotificationItem | null
  notificationId: number | null
  unreadCount: number | null
  serverTime: string
}
