import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../../i18n'
import type { NotificationItem, NotificationSseEnvelope } from '../model/types'
import { notificationKeys } from '../api/notificationsApi'
import { NOTIFICATION_STREAM_LEASE_MS, notificationStreamLeaderKey } from '../utils/notificationStreamLeader'
import { NotificationProvider, useNotificationContext } from './NotificationProvider'

const mocks = vi.hoisted(() => ({
  openStream: vi.fn(),
  notify: vi.fn(),
  play: vi.fn(),
  suspend: vi.fn(),
  prepareStoredCustom: vi.fn(),
}))
const stableUser = {
  id: 1,
  username: 'recipient',
  displayName: 'Recipient',
  defaultBranchId: 1,
  roles: [],
  permissions: [],
  branches: [{ id: 1, code: 'CN1', name: 'Chi nhĂ¡nh 1' }],
  authorizationVersion: 1,
}

vi.mock('../api/notificationsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/notificationsApi')>()),
  openNotificationStream: mocks.openStream,
}))
vi.mock('../../../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: stableUser,
    hasPermission: () => true,
  }),
}))
vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({
    data: {
      content: [],
      page: 0,
      size: 10,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      unreadCount: 0,
    },
    isLoading: false,
    isError: false,
  }),
  useUnreadNotificationCount: () => ({ data: { unreadCount: 0 } }),
  useNotificationPreferences: () => ({ data: undefined }),
}))
vi.mock('../../../providers/ToastProvider', () => ({
  useToast: () => ({ notify: mocks.notify }),
}))
vi.mock('../sound/notificationSound', () => ({
  notificationSoundEngine: {
    play: mocks.play,
    suspend: mocks.suspend,
    prepareStoredCustomSound: mocks.prepareStoredCustom,
    unlockAndPreview: vi.fn(),
  },
}))

function Probe() {
  const value = useNotificationContext()
  return <span data-testid="pulse">{value.bellPulse}:{value.connectionState}</span>
}

const item: NotificationItem = {
  id: 41,
  type: 'EMPLOYEE_BRANCH_CHANGED',
  severity: 'INFO',
  titleKey: 'notification.employeeBranchChanged.title',
  messageKey: 'notification.employeeBranchChanged.message',
  titleFallback: 'Branch changed',
  messageFallback: 'Your branch changed',
  metadata: { employeeName: 'A' },
  branchId: 1,
  referenceType: 'EMPLOYEE',
  referenceId: '7',
  deepLink: '/employees/7',
  createdAt: '2026-07-23T10:00:00Z',
  readAt: null,
  unread: true,
}

describe('NotificationProvider', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-23T10:00:10Z'))
    mocks.openStream.mockReset()
    mocks.notify.mockReset()
    mocks.play.mockReset().mockResolvedValue('played')
    mocks.suspend.mockReset().mockResolvedValue(undefined)
    mocks.prepareStoredCustom.mockReset().mockResolvedValue(null)
    localStorage.clear()
    sessionStorage.clear()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('deduplicates event IDs and applies the four-second sound cooldown', async () => {
    let handlers: {
      onOpen: () => void
      onEvent: (event: NotificationSseEnvelope) => void
    } | undefined
    mocks.openStream.mockImplementation((signal: AbortSignal, nextHandlers) => {
      handlers = nextHandlers
      nextHandlers.onOpen()
      return new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true })
      })
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(notificationKeys.preferences, {
      soundEnabled: true,
      soundKey: 'SOFT_CHIME',
      soundVolume: 65,
      toastEnabled: true,
      bellAnimationEnabled: true,
      version: 0,
    })
    queryClient.setQueryData(notificationKeys.recent, {
      content: [],
      page: 0,
      size: 10,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      unreadCount: 0,
    })
    const centerFilters = { page: 0, size: 20, status: 'ALL' as const }
    queryClient.setQueryData(notificationKeys.list(centerFilters), {
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      unreadCount: 0,
    })
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationProvider><Probe /></NotificationProvider>
      </QueryClientProvider>,
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(handlers).toBeDefined()

    const firstEvent: NotificationSseEnvelope = {
      eventId: 'event-1',
      eventType: 'notification.created',
      notification: item,
      notificationId: item.id,
      unreadCount: 1,
      serverTime: '2026-07-23T10:00:10Z',
    }
    act(() => {
      handlers?.onEvent(firstEvent)
      handlers?.onEvent(firstEvent)
    })
    await act(async () => {
      vi.advanceTimersByTime(400)
      await Promise.resolve()
    })

    expect(screen.getByTestId('pulse')).toHaveTextContent('1:connected')
    expect(mocks.notify).toHaveBeenCalledTimes(1)
    expect(mocks.play).toHaveBeenCalledTimes(1)
    expect(queryClient.getQueryData<{ unreadCount: number }>(notificationKeys.unread))
      .toEqual({ unreadCount: 1 })
    expect(queryClient.getQueryData<{ content: NotificationItem[] }>(notificationKeys.recent)?.content)
      .toHaveLength(1)
    expect(queryClient.getQueryData<{ content: NotificationItem[] }>(
      notificationKeys.list(centerFilters),
    )?.content).toHaveLength(1)

    act(() => {
      handlers?.onEvent({
        ...firstEvent,
        eventId: 'event-2',
        notification: { ...item, id: 42 },
        notificationId: 42,
        unreadCount: 2,
      })
    })
    await act(async () => {
      vi.advanceTimersByTime(400)
      await Promise.resolve()
    })

    expect(mocks.notify).toHaveBeenCalledTimes(2)
    expect(mocks.play).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('pulse')).toHaveTextContent('2:connected')
  })

  it('does not open a second SSE stream while another tab owns the active lease', async () => {
    class MockBroadcastChannel {
      onmessage: ((message: MessageEvent) => void) | null = null

      constructor(readonly name: string) {}

      postMessage() {}

      close() {
        this.onmessage = null
      }
    }
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
    localStorage.setItem(notificationStreamLeaderKey(stableUser.id), JSON.stringify({
      tabId: 'other-tab',
      userId: stableUser.id,
      expiresAt: Date.now() + NOTIFICATION_STREAM_LEASE_MS,
      updatedAt: Date.now(),
    }))
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <NotificationProvider><Probe /></NotificationProvider>
      </QueryClientProvider>,
    )
    await act(async () => {
      await Promise.resolve()
    })

    expect(mocks.openStream).not.toHaveBeenCalled()
    expect(screen.getByTestId('pulse')).toHaveTextContent('0:connecting')
  })
})
