import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NotificationItem } from '../model/types'
import { relativeNotificationTime, resolveNotificationRoute } from './notificationDisplay'

const base: NotificationItem = {
  id: 1,
  type: 'EMPLOYEE_BRANCH_CHANGED',
  severity: 'INFO',
  titleKey: 'notification.employeeBranchChanged.title',
  messageKey: 'notification.employeeBranchChanged.message',
  titleFallback: 'Branch changed',
  messageFallback: 'Branch changed',
  metadata: {},
  branchId: 1,
  referenceType: 'EMPLOYEE',
  referenceId: '42',
  deepLink: '/employees/42',
  createdAt: '2026-07-23T10:00:00Z',
  readAt: null,
  unread: true,
}

describe('resolveNotificationRoute', () => {
  it('allows a known route only when reference and deep link agree', () => {
    expect(resolveNotificationRoute(base)).toBe('/employees/42')
    expect(resolveNotificationRoute({ ...base, deepLink: 'https://example.com' })).toBeNull()
    expect(resolveNotificationRoute({ ...base, deepLink: '/employees/99' })).toBeNull()
  })
})

describe('relativeNotificationTime', () => {
  afterEach(() => vi.useRealTimers())

  it('uses relative Vietnamese labels only during the first hour', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T05:30:00Z'))

    expect(relativeNotificationTime('2026-10-01T05:29:30Z', 'vi')).toBe('Vừa xong')
    expect(relativeNotificationTime('2026-10-01T05:28:00Z', 'vi')).toBe('2 phút trước')
    expect(relativeNotificationTime('2026-10-01T04:30:00Z', 'vi')).toBe('11:30 01/10/2026')
  })

  it('keeps the existing English labels for recent notifications', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T05:30:00Z'))

    expect(relativeNotificationTime('2026-10-01T05:29:30Z', 'en')).toBe('Just now')
    expect(relativeNotificationTime('2026-10-01T05:28:00Z', 'en')).toBe('2 min ago')
  })
})
