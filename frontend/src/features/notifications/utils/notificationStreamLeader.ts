export interface NotificationStreamLeaderLease {
  tabId: string
  userId: number
  expiresAt: number
  updatedAt: number
}

export const NOTIFICATION_STREAM_LEASE_MS = 12_000

export function notificationStreamLeaderKey(userId: number) {
  return `laundry.notifications.stream-leader:${userId}`
}

export function readNotificationStreamLeader(
  storage: Storage,
  key: string,
): NotificationStreamLeaderLease | null {
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<NotificationStreamLeaderLease>
    if (
      typeof parsed.tabId !== 'string'
      || typeof parsed.userId !== 'number'
      || typeof parsed.expiresAt !== 'number'
      || typeof parsed.updatedAt !== 'number'
    ) {
      return null
    }
    return parsed as NotificationStreamLeaderLease
  } catch {
    return null
  }
}

export function hasCurrentNotificationStreamLeader(
  storage: Storage,
  key: string,
  userId: number,
  now = Date.now(),
) {
  const lease = readNotificationStreamLeader(storage, key)
  return Boolean(lease && lease.userId === userId && lease.expiresAt > now)
}

export function claimNotificationStreamLeadership(
  storage: Storage,
  key: string,
  tabId: string,
  userId: number,
  now = Date.now(),
) {
  try {
    const current = readNotificationStreamLeader(storage, key)
    if (current && current.userId === userId && current.tabId !== tabId && current.expiresAt > now) {
      return false
    }
    const next: NotificationStreamLeaderLease = {
      tabId,
      userId,
      expiresAt: now + NOTIFICATION_STREAM_LEASE_MS,
      updatedAt: now,
    }
    storage.setItem(key, JSON.stringify(next))
    const confirmed = readNotificationStreamLeader(storage, key)
    return confirmed?.tabId === tabId && confirmed.userId === userId
  } catch {
    return true
  }
}

export function renewNotificationStreamLeadership(
  storage: Storage,
  key: string,
  tabId: string,
  userId: number,
  now = Date.now(),
) {
  try {
    const current = readNotificationStreamLeader(storage, key)
    if (!current || current.tabId !== tabId || current.userId !== userId) return false
    const next: NotificationStreamLeaderLease = {
      tabId,
      userId,
      expiresAt: now + NOTIFICATION_STREAM_LEASE_MS,
      updatedAt: now,
    }
    storage.setItem(key, JSON.stringify(next))
    return true
  } catch {
    return true
  }
}

export function releaseNotificationStreamLeadership(
  storage: Storage,
  key: string,
  tabId: string,
  userId: number,
) {
  try {
    const current = readNotificationStreamLeader(storage, key)
    if (current?.tabId === tabId && current.userId === userId) storage.removeItem(key)
  } catch {
    // Best-effort cleanup only.
  }
}
