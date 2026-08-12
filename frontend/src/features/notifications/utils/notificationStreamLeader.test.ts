import { describe, expect, it } from 'vitest'
import {
  claimNotificationStreamLeadership,
  hasCurrentNotificationStreamLeader,
  notificationStreamLeaderKey,
  readNotificationStreamLeader,
  releaseNotificationStreamLeadership,
  renewNotificationStreamLeadership,
} from './notificationStreamLeader'

describe('notification stream leadership', () => {
  it('keeps a single current leader and allows takeover after expiry', () => {
    const storage = localStorage
    storage.clear()
    const key = notificationStreamLeaderKey(7)

    expect(claimNotificationStreamLeadership(storage, key, 'tab-a', 7, 1_000)).toBe(true)
    expect(claimNotificationStreamLeadership(storage, key, 'tab-b', 7, 2_000)).toBe(false)
    expect(hasCurrentNotificationStreamLeader(storage, key, 7, 2_000)).toBe(true)
    expect(claimNotificationStreamLeadership(storage, key, 'tab-b', 7, 20_000)).toBe(true)

    const lease = readNotificationStreamLeader(storage, key)
    expect(lease?.tabId).toBe('tab-b')
  })

  it('renews and releases only the owning tab lease', () => {
    const storage = localStorage
    storage.clear()
    const key = notificationStreamLeaderKey(9)

    expect(claimNotificationStreamLeadership(storage, key, 'tab-a', 9, 1_000)).toBe(true)
    expect(renewNotificationStreamLeadership(storage, key, 'tab-b', 9, 2_000)).toBe(false)
    expect(renewNotificationStreamLeadership(storage, key, 'tab-a', 9, 2_000)).toBe(true)
    expect(readNotificationStreamLeader(storage, key)?.expiresAt).toBeGreaterThan(12_000)

    releaseNotificationStreamLeadership(storage, key, 'tab-b', 9)
    expect(readNotificationStreamLeader(storage, key)?.tabId).toBe('tab-a')
    releaseNotificationStreamLeadership(storage, key, 'tab-a', 9)
    expect(readNotificationStreamLeader(storage, key)).toBeNull()
  })
})
