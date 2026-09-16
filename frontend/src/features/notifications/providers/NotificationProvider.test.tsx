import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../../i18n'
import type { CurrentUser } from '../../../api/types'
import type { RealtimeEvent } from '../../../realtime/types'
import { notificationKeys } from '../api/notificationsApi'
import type { NotificationItem } from '../model/types'
import { NotificationProvider, useNotificationContext } from './NotificationProvider'

const mocks = vi.hoisted(() => ({
  notify: vi.fn(), play: vi.fn(), suspend: vi.fn(), prepareStoredCustom: vi.fn(),
  authUser: null as CurrentUser | null,
  subscribers: new Map<string, (event: RealtimeEvent) => void>(),
}))
const stableUser = { id: 1, username: 'recipient', displayName: 'Recipient', defaultBranchId: 1,
  roles: [], permissions: [], branches: [{ id: 1, code: 'CN1', name: 'Chi nhánh 1' }], authorizationVersion: 1 }
vi.mock('../../../auth/AuthProvider', () => ({ useAuth: () => ({ user: mocks.authUser, hasPermission: () => true }) }))
vi.mock('../../../realtime/context', () => ({ useRealtime: () => ({ connectionState: 'connected', subscribe: (prefix: string, subscriber: (event: RealtimeEvent) => void) => { mocks.subscribers.set(prefix, subscriber); return () => mocks.subscribers.delete(prefix) } }) }))
vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({ data: { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, hasNext: false, unreadCount: 0 }, isLoading: false, isError: false }),
  useUnreadNotificationCount: () => ({ data: { unreadCount: 0 } }), useNotificationPreferences: () => ({ data: undefined }),
}))
vi.mock('../../../providers/ToastProvider', () => ({ useToast: () => ({ notify: mocks.notify }) }))
vi.mock('../sound/notificationSound', () => ({ notificationSoundEngine: { play: mocks.play, suspend: mocks.suspend, prepareStoredCustomSound: mocks.prepareStoredCustom, unlockAndPreview: vi.fn() } }))

function Probe() { const value = useNotificationContext(); return <span data-testid="pulse">{value.bellPulse}:{value.connectionState}</span> }
const item: NotificationItem = { id: 41, type: 'EMPLOYEE_BRANCH_CHANGED', severity: 'INFO', titleKey: 'notification.employeeBranchChanged.title', messageKey: 'notification.employeeBranchChanged.message', titleFallback: 'Branch changed', messageFallback: 'Your branch changed', metadata: { employeeName: 'A' }, branchId: 1, referenceType: 'EMPLOYEE', referenceId: '7', deepLink: '/employees/7', createdAt: '2026-07-23T10:00:00Z', readAt: null, unread: true }

describe('NotificationProvider projection', () => {
  beforeEach(() => { vi.useFakeTimers(); mocks.notify.mockReset(); mocks.play.mockReset().mockResolvedValue('played'); mocks.suspend.mockReset().mockResolvedValue(undefined); mocks.prepareStoredCustom.mockReset().mockResolvedValue(null); mocks.authUser = stableUser; mocks.subscribers.clear(); localStorage.clear(); sessionStorage.clear(); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); vi.spyOn(document, 'hasFocus').mockReturnValue(true) })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('projects a generic realtime notification into cache, bell, toast and sound', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(notificationKeys.preferences, { soundEnabled: true, soundKey: 'SOFT_CHIME', soundVolume: 65, toastEnabled: true, bellAnimationEnabled: true, version: 0 })
    queryClient.setQueryData(notificationKeys.recent, { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, hasNext: false, unreadCount: 0 })
    render(<QueryClientProvider client={queryClient}><NotificationProvider><Probe /></NotificationProvider></QueryClientProvider>)
    const event = { eventId: 'event-1', eventType: 'notification.created', notification: item, notificationId: item.id, unreadCount: 1, serverTime: '2026-07-23T10:00:10Z' }
    act(() => mocks.subscribers.get('notification.')?.(event))
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve() })
    expect(screen.getByTestId('pulse')).toHaveTextContent('1:connected')
    expect(mocks.notify).toHaveBeenCalledOnce(); expect(mocks.play).toHaveBeenCalledOnce()
    expect(queryClient.getQueryData(notificationKeys.unread)).toEqual({ unreadCount: 1 })
  })

  it('refreshes notification queries after a generic realtime reconnect event', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    render(<QueryClientProvider client={queryClient}><NotificationProvider><Probe /></NotificationProvider></QueryClientProvider>)
    act(() => mocks.subscribers.get('realtime.reconnected')?.({ eventId: 'reconnect-1', type: 'realtime.reconnected' }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: notificationKeys.unread })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: notificationKeys.all })
  })
})
