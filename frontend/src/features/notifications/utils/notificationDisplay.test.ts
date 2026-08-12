import { describe, expect, it } from 'vitest'
import type { NotificationItem } from '../model/types'
import { resolveNotificationRoute } from './notificationDisplay'

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
