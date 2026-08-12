import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markNotificationRead, notificationKeys } from '../api/notificationsApi'
import type { NotificationPage, NotificationPreferences } from '../model/types'
import { useMarkNotificationRead } from './useNotifications'

vi.mock('../api/notificationsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/notificationsApi')>()
  return {
    ...actual,
    markNotificationRead: vi.fn(),
  }
})

const page: NotificationPage = {
  content: [{
    id: 42,
    type: 'GENERIC_INTERNAL',
    severity: 'INFO',
    titleKey: 'notification.test.title',
    messageKey: 'notification.test.message',
    titleFallback: 'Test',
    messageFallback: 'Test',
    metadata: {},
    branchId: 1,
    referenceType: null,
    referenceId: null,
    deepLink: null,
    createdAt: '2026-07-23T10:00:00Z',
    readAt: null,
    unread: true,
  }],
  page: 0,
  size: 10,
  totalElements: 1,
  totalPages: 1,
  hasNext: false,
  unreadCount: 1,
}

const preferences: NotificationPreferences = {
  soundEnabled: true,
  soundKey: 'SOFT_CHIME',
  soundVolume: 50,
  toastEnabled: true,
  bellAnimationEnabled: true,
  version: 0,
}

describe('useMarkNotificationRead', () => {
  beforeEach(() => {
    vi.mocked(markNotificationRead).mockReset()
  })

  it('updates list and unread caches without treating preferences as a page', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    queryClient.setQueryData(notificationKeys.recent, page)
    queryClient.setQueryData(notificationKeys.unread, { unreadCount: 1 })
    queryClient.setQueryData(notificationKeys.preferences, preferences)
    vi.mocked(markNotificationRead).mockResolvedValue({
      notificationId: 42,
      updated: 1,
      unreadCount: 0,
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(42)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(queryClient.getQueryData<NotificationPage>(notificationKeys.recent)?.content[0].unread)
      .toBe(false)
    expect(queryClient.getQueryData(notificationKeys.unread)).toEqual({ unreadCount: 0 })
    expect(queryClient.getQueryData(notificationKeys.preferences)).toEqual(preferences)
  })
})
