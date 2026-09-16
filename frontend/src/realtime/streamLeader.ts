export interface RealtimeLeaderLease { tabId: string; userId: number; expiresAt: number; updatedAt: number }
export const REALTIME_STREAM_LEASE_MS = 12_000
export const realtimeStreamLeaderKey = (userId: number) => `laundry.realtime.stream-leader:${userId}`

export function readRealtimeStreamLeader(storage: Storage, key: string): RealtimeLeaderLease | null {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? 'null') as Partial<RealtimeLeaderLease> | null
    return parsed && typeof parsed.tabId === 'string' && typeof parsed.userId === 'number'
      && typeof parsed.expiresAt === 'number' && typeof parsed.updatedAt === 'number'
      ? parsed as RealtimeLeaderLease : null
  } catch { return null }
}
export function hasCurrentRealtimeStreamLeader(storage: Storage, key: string, userId: number, now = Date.now()) {
  const lease = readRealtimeStreamLeader(storage, key); return Boolean(lease && lease.userId === userId && lease.expiresAt > now)
}
export function claimRealtimeStreamLeadership(storage: Storage, key: string, tabId: string, userId: number, now = Date.now()) {
  try {
    const current = readRealtimeStreamLeader(storage, key)
    if (current && current.userId === userId && current.tabId !== tabId && current.expiresAt > now) return false
    storage.setItem(key, JSON.stringify({ tabId, userId, expiresAt: now + REALTIME_STREAM_LEASE_MS, updatedAt: now }))
    const confirmed = readRealtimeStreamLeader(storage, key); return confirmed?.tabId === tabId && confirmed.userId === userId
  } catch { return true }
}
export function renewRealtimeStreamLeadership(storage: Storage, key: string, tabId: string, userId: number, now = Date.now()) {
  try {
    const current = readRealtimeStreamLeader(storage, key); if (!current || current.tabId !== tabId || current.userId !== userId) return false
    storage.setItem(key, JSON.stringify({ tabId, userId, expiresAt: now + REALTIME_STREAM_LEASE_MS, updatedAt: now })); return true
  } catch { return true }
}
export function releaseRealtimeStreamLeadership(storage: Storage, key: string, tabId: string, userId: number) {
  try { const current = readRealtimeStreamLeader(storage, key); if (current?.tabId === tabId && current.userId === userId) storage.removeItem(key) } catch { /* best effort */ }
}
