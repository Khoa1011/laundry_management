import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../../auth/permissionCodes.generated'
import { useToast } from '../../../providers/ToastProvider'
import {
  isRetryableNotificationStreamError,
  notificationKeys,
  openNotificationStream,
} from '../api/notificationsApi'
import { useNotificationPreferences, useNotifications, useUnreadNotificationCount } from '../hooks/useNotifications'
import type {
  NotificationConnectionState,
  NotificationFilters,
  NotificationItem,
  NotificationPage,
  NotificationPreferences,
  NotificationSseEnvelope,
} from '../model/types'
import { notificationSoundEngine } from '../sound/notificationSound'
import { notificationText, resolveNotificationRoute } from '../utils/notificationDisplay'
import {
  claimNotificationStreamLeadership,
  hasCurrentNotificationStreamLeader,
  notificationStreamLeaderKey,
  releaseNotificationStreamLeadership,
  renewNotificationStreamLeadership,
} from '../utils/notificationStreamLeader'

const RECENT_FILTERS = { page: 0, size: 10, status: 'ALL' as const }
const MAX_EVENT_IDS = 240
const SOUND_COOLDOWN_MS = 4_000
const AUDIO_LOCK_KEY = 'laundry.notifications.audio-lock'
const NOTIFICATION_CHANNEL_NAME = 'laundry-notifications'
const LEADER_RENEW_MS = 4_000
const FOLLOWER_CHECK_MS = 3_000

interface NotificationContextValue {
  canRead: boolean
  recentNotifications: NotificationItem[]
  unreadCount: number
  isLoading: boolean
  isError: boolean
  connectionState: NotificationConnectionState
  bellPulse: number
  latestRealtimeNotificationId: number | null
  refresh: () => Promise<void>
}

type NotificationBroadcastMessage =
  | { type: 'effect-seen'; eventId: string; userId?: number }
  | { type: 'unread-count'; unreadCount: number; userId?: number }
  | { type: 'sse-event'; event: NotificationSseEnvelope; userId: number }
  | { type: 'leader-state'; state: NotificationConnectionState; userId: number; tabId: string }
  | { type: 'stream-blocked'; userId: number }

const NotificationContext = createContext<NotificationContextValue | null>(null)

function rememberBounded(set: Set<string>, order: string[], value: string) {
  if (set.has(value)) return false
  set.add(value)
  order.push(value)
  while (order.length > MAX_EVENT_IDS) {
    const removed = order.shift()
    if (removed) set.delete(removed)
  }
  return true
}

function matchesNotificationFilters(item: NotificationItem, filters: NotificationFilters) {
  if (filters.status === 'READ' && item.unread) return false
  if (filters.status === 'UNREAD' && !item.unread) return false
  if (filters.type && filters.type !== item.type) return false
  if (filters.severity && filters.severity !== item.severity) return false
  if (filters.branchId && filters.branchId !== item.branchId) return false
  if (filters.referenceType && filters.referenceType !== item.referenceType) return false
  return true
}

function mergeCreatedNotification(
  page: NotificationPage,
  item: NotificationItem,
  unreadCount: number | null,
) {
  const alreadyPresent = page.content.some((candidate) => candidate.id === item.id)
  const totalElements = alreadyPresent ? page.totalElements : page.totalElements + 1
  const content = [item, ...page.content.filter((candidate) => candidate.id !== item.id)]
    .slice(0, page.size)
  const totalPages = page.size > 0 ? Math.ceil(totalElements / page.size) : page.totalPages
  return {
    ...page,
    content,
    totalElements,
    totalPages,
    hasNext: totalPages > page.page + 1,
    unreadCount: unreadCount ?? page.unreadCount + (alreadyPresent ? 0 : 1),
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { user, hasPermission } = useAuth()
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const canRead = Boolean(user) && hasPermission(PERMISSION_CODES.NOTIFICATION_READ_OWN)
  const canManagePreferences = Boolean(user)
    && hasPermission(PERMISSION_CODES.NOTIFICATION_PREFERENCES_MANAGE_OWN)
  const recentQuery = useNotifications(RECENT_FILTERS, canRead)
  const unreadQuery = useUnreadNotificationCount(canRead)
  useNotificationPreferences(canManagePreferences)
  const [connectionState, setConnectionState] = useState<NotificationConnectionState>('idle')
  const [bellPulse, setBellPulse] = useState(0)
  const [latestRealtimeNotificationId, setLatestRealtimeNotificationId] = useState<number | null>(null)
  const handledIds = useRef(new Set<string>())
  const handledOrder = useRef<string[]>([])
  const effectIds = useRef(new Set<string>())
  const effectOrder = useRef<string[]>([])
  const broadcastChannel = useRef<BroadcastChannel | null>(null)
  const pendingBatch = useRef<Array<{ eventId: string; item: NotificationItem }>>([])
  const batchTimer = useRef<number | null>(null)
  const lastSoundAt = useRef(0)
  const streamBlocked = useRef(false)

  useEffect(() => {
    if (!user?.id) return
    void notificationSoundEngine.prepareStoredCustomSound(`user:${user.id}`)
  }, [user?.id])

  const refresh = useCallback(async () => {
    if (!canRead) return
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread }),
      queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    ])
  }, [canRead, queryClient])

  const showAudioUnlock = useCallback((preferences: NotificationPreferences) => {
    const key = 'laundry.notifications.audio-prompt-dismissed'
    if (sessionStorage.getItem(key) === 'true') return
    sessionStorage.setItem(key, 'true')
    notify({
      message: t('notification:settings.audioBlocked'),
      tone: 'info',
      duration: 8_000,
      actionLabel: t('notification:settings.enableAudio'),
      onAction: () => {
        void notificationSoundEngine.unlockAndPreview(
          preferences.soundKey,
          preferences.soundVolume,
          `user:${user?.id ?? 'device'}`,
        )
      },
    })
  }, [notify, t, user?.id])

  const claimAudio = useCallback((eventId: string) => {
    if (document.visibilityState !== 'visible' || !document.hasFocus()) return false
    const tabId = getTabId()
    const now = Date.now()
    try {
      const existing = JSON.parse(localStorage.getItem(AUDIO_LOCK_KEY) ?? 'null') as
        | { eventId: string; tabId: string; expiresAt: number }
        | null
      if (existing?.eventId === eventId && existing.expiresAt > now) return existing.tabId === tabId
      const lock = { eventId, tabId, expiresAt: now + 8_000 }
      localStorage.setItem(AUDIO_LOCK_KEY, JSON.stringify(lock))
      const confirmed = JSON.parse(localStorage.getItem(AUDIO_LOCK_KEY) ?? 'null') as typeof lock | null
      return confirmed?.eventId === eventId && confirmed.tabId === tabId
    } catch {
      return true
    }
  }, [])

  const flushRealtimeBatch = useCallback(async () => {
    batchTimer.current = null
    const batch = pendingBatch.current.splice(0)
    if (batch.length === 0) return
    const preferences = queryClient.getQueryData<NotificationPreferences>(notificationKeys.preferences)
      ?? {
        soundEnabled: true,
        soundKey: 'SOFT_CHIME',
        soundVolume: 65,
        toastEnabled: true,
        bellAnimationEnabled: true,
        version: 0,
      }
    const newest = batch[batch.length - 1]
    if (preferences.toastEnabled) {
      if (batch.length === 1) {
        const text = notificationText(newest.item, t)
        const route = resolveNotificationRoute(newest.item)
        notify({
          title: text.title,
          message: text.message,
          tone: newest.item.severity === 'ERROR' || newest.item.severity === 'ACTION_REQUIRED'
            ? 'error'
            : newest.item.severity === 'SUCCESS' ? 'success' : 'info',
          duration: newest.item.severity === 'WARNING' ? 6_000
            : newest.item.severity === 'ERROR' ? 8_000
              : newest.item.severity === 'ACTION_REQUIRED' ? undefined : 4_000,
          persistent: newest.item.severity === 'ACTION_REQUIRED',
          actionLabel: route ? t('notification:action.open') : undefined,
          onAction: route ? () => {
            window.dispatchEvent(new CustomEvent('laundry:navigate', { detail: route }))
          } : undefined,
        })
      } else {
        notify({
          title: t('notification:toast.groupedTitle', { count: batch.length }),
          message: t('notification:toast.groupedMessage'),
          tone: 'info',
          duration: 6_000,
        })
      }
    }
    if (
      preferences.soundEnabled
      && Date.now() - lastSoundAt.current >= SOUND_COOLDOWN_MS
      && claimAudio(newest.eventId)
    ) {
      lastSoundAt.current = Date.now()
      const result = await notificationSoundEngine.play(
        preferences.soundKey,
        preferences.soundVolume,
        `user:${user?.id ?? 'device'}`,
      )
      if (result === 'blocked') showAudioUnlock(preferences)
    }
  }, [claimAudio, notify, queryClient, showAudioUnlock, t, user?.id])

  const queueRealtimeEffect = useCallback((eventId: string, item: NotificationItem) => {
    if (!rememberBounded(effectIds.current, effectOrder.current, eventId)) return
    pendingBatch.current.push({ eventId, item })
    if (batchTimer.current === null) {
      batchTimer.current = window.setTimeout(() => { void flushRealtimeBatch() }, 350)
    }
    broadcastChannel.current?.postMessage({ type: 'effect-seen', eventId, userId: user?.id })
  }, [flushRealtimeBatch, user?.id])

  const handleEvent = useCallback((event: NotificationSseEnvelope, source: 'stream' | 'broadcast' = 'stream') => {
    if (!event.eventId || !rememberBounded(handledIds.current, handledOrder.current, event.eventId)) return
    if (source === 'stream' && user?.id) {
      broadcastChannel.current?.postMessage({ type: 'sse-event', event, userId: user.id })
    }
    if (typeof event.unreadCount === 'number') {
      queryClient.setQueryData(notificationKeys.unread, { unreadCount: event.unreadCount })
      if (source === 'stream' && user?.id) {
        broadcastChannel.current?.postMessage({
          type: 'unread-count',
          unreadCount: event.unreadCount,
          userId: user.id,
        })
      }
    }
    if (event.eventType === 'notification.created' && event.notification) {
      const item = event.notification
      setLatestRealtimeNotificationId(item.id)
      const listQueries = queryClient.getQueriesData<NotificationPage>({
        queryKey: ['notifications', 'list'],
      })
      for (const [queryKey, page] of listQueries) {
        if (!page) continue
        const filters = queryKey[2] as NotificationFilters | undefined
        queryClient.setQueryData<NotificationPage>(queryKey, (current) => {
          if (!current) return current
          if (!filters || (filters.page ?? 0) !== 0 || !matchesNotificationFilters(item, filters)) {
            return typeof event.unreadCount === 'number'
              ? { ...current, unreadCount: event.unreadCount }
              : current
          }
          return mergeCreatedNotification(current, item, event.unreadCount)
        })
      }
      if (!queryClient.getQueryData<NotificationPage>(notificationKeys.recent)) {
        queryClient.setQueryData<NotificationPage>(notificationKeys.recent, {
          content: [item],
          page: 0,
          size: 10,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
          unreadCount: event.unreadCount ?? 1,
        })
      }
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'list'], refetchType: 'none' })
      const preferences = queryClient.getQueryData<NotificationPreferences>(notificationKeys.preferences)
      if (preferences?.bellAnimationEnabled !== false) setBellPulse((value) => value + 1)
      queueRealtimeEffect(event.eventId, item)
      return
    }
    if (event.eventType === 'notification.read' || event.eventType === 'notification.dismissed') {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    }
  }, [queryClient, queueRealtimeEffect, user?.id])

  useEffect(() => {
    if (!canRead || typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(NOTIFICATION_CHANNEL_NAME)
    broadcastChannel.current = channel
    channel.onmessage = (message: MessageEvent<NotificationBroadcastMessage>) => {
      if (message.data.userId && message.data.userId !== user?.id) return
      if (message.data.type === 'effect-seen') {
        rememberBounded(effectIds.current, effectOrder.current, message.data.eventId)
      }
      if (message.data.type === 'unread-count') {
        queryClient.setQueryData(notificationKeys.unread, { unreadCount: message.data.unreadCount })
      }
      if (message.data.type === 'sse-event') {
        handleEvent(message.data.event, 'broadcast')
      }
      if (message.data.type === 'leader-state') {
        const leaderConnectionState = message.data.state
        setConnectionState((current) => {
          if (current === 'offline') return current
          return leaderConnectionState
        })
      }
      if (message.data.type === 'stream-blocked') {
        streamBlocked.current = true
        setConnectionState('idle')
      }
    }
    return () => {
      channel.close()
      broadcastChannel.current = null
    }
  }, [canRead, handleEvent, queryClient, user?.id])

  useEffect(() => {
    if (!canRead || !user) {
      setConnectionState('idle')
      return
    }
    streamBlocked.current = false
    let stopped = false
    let isLeader = false
    let retryDelay = 1_000
    let retryTimer: number | null = null
    let leaderRenewTimer: number | null = null
    let followerCheckTimer: number | null = null
    let controller: AbortController | null = null
    let leaderState: NotificationConnectionState = 'connecting'
    const tabId = getTabId()
    const leaderKey = notificationStreamLeaderKey(user.id)
    const canCoordinateTabs = typeof BroadcastChannel !== 'undefined' && typeof localStorage !== 'undefined'

    const publishLeaderState = (state: NotificationConnectionState) => {
      leaderState = state
      if (canCoordinateTabs) {
        broadcastChannel.current?.postMessage({ type: 'leader-state', state, userId: user.id, tabId })
      }
    }

    const clearRetry = () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      retryTimer = null
    }
    const clearLeaderRenewal = () => {
      if (leaderRenewTimer !== null) window.clearInterval(leaderRenewTimer)
      leaderRenewTimer = null
    }
    const clearFollowerCheck = () => {
      if (followerCheckTimer !== null) window.clearInterval(followerCheckTimer)
      followerCheckTimer = null
    }
    const stopLeadership = () => {
      isLeader = false
      clearLeaderRenewal()
      if (canCoordinateTabs) {
        releaseNotificationStreamLeadership(localStorage, leaderKey, tabId, user.id)
      }
    }
    const schedule = () => {
      if (stopped || streamBlocked.current || retryTimer !== null || !navigator.onLine) {
        if (!navigator.onLine) setConnectionState('offline')
        return
      }
      if (canCoordinateTabs && !isLeader) return
      setConnectionState('reconnecting')
      publishLeaderState('reconnecting')
      retryTimer = window.setTimeout(() => {
        retryTimer = null
        void connect()
      }, retryDelay)
      retryDelay = Math.min(30_000, retryDelay * 2)
    }
    const ensureFollowerCheck = () => {
      if (!canCoordinateTabs || followerCheckTimer !== null) return
      followerCheckTimer = window.setInterval(() => {
        if (stopped || streamBlocked.current) return
        if (!navigator.onLine) {
          setConnectionState('offline')
          return
        }
        if (!hasCurrentNotificationStreamLeader(localStorage, leaderKey, user.id)) {
          void claimAndConnect()
        }
      }, FOLLOWER_CHECK_MS)
    }
    const startLeaderRenewal = () => {
      if (!canCoordinateTabs) return
      clearLeaderRenewal()
      leaderRenewTimer = window.setInterval(() => {
        if (stopped || streamBlocked.current) return
        const renewed = renewNotificationStreamLeadership(localStorage, leaderKey, tabId, user.id)
        if (!renewed) {
          controller?.abort()
          stopLeadership()
          setConnectionState('reconnecting')
          ensureFollowerCheck()
        } else {
          publishLeaderState(leaderState)
        }
      }, LEADER_RENEW_MS)
    }
    const claimAndConnect = async () => {
      if (stopped || streamBlocked.current) return
      if (!navigator.onLine) {
        setConnectionState('offline')
        return
      }
      if (canCoordinateTabs) {
        const claimed = claimNotificationStreamLeadership(localStorage, leaderKey, tabId, user.id)
        if (!claimed) {
          isLeader = false
          setConnectionState('connecting')
          ensureFollowerCheck()
          return
        }
      }
      isLeader = true
      clearFollowerCheck()
      startLeaderRenewal()
      await connect()
    }
    const connect = async () => {
      if (stopped || streamBlocked.current || (canCoordinateTabs && !isLeader)) return
      if (!navigator.onLine) {
        setConnectionState('offline')
        return
      }
      controller?.abort()
      controller = new AbortController()
      setConnectionState((current) => current === 'idle' ? 'connecting' : 'reconnecting')
      publishLeaderState('reconnecting')
      try {
        await openNotificationStream(controller.signal, {
          onOpen: () => {
            retryDelay = 1_000
            setConnectionState('connected')
            publishLeaderState('connected')
            void refresh()
          },
          onEvent: (event) => handleEvent(event, 'stream'),
        })
        if (!controller.signal.aborted) schedule()
      } catch (error) {
        if (controller.signal.aborted) return
        if (!isRetryableNotificationStreamError(error)) {
          streamBlocked.current = true
          setConnectionState('idle')
          broadcastChannel.current?.postMessage({ type: 'stream-blocked', userId: user.id })
          stopLeadership()
          return
        }
        schedule()
      }
    }
    const onOffline = () => {
      clearRetry()
      controller?.abort()
      setConnectionState('offline')
      publishLeaderState('offline')
    }
    const onOnline = () => {
      clearRetry()
      void claimAndConnect()
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    void claimAndConnect()
    return () => {
      stopped = true
      clearRetry()
      clearLeaderRenewal()
      clearFollowerCheck()
      controller?.abort()
      stopLeadership()
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      if (batchTimer.current !== null) window.clearTimeout(batchTimer.current)
      batchTimer.current = null
      pendingBatch.current = []
      void notificationSoundEngine.suspend()
    }
  }, [canRead, handleEvent, refresh, user])

  const value = useMemo<NotificationContextValue>(() => ({
    canRead,
    recentNotifications: recentQuery.data?.content ?? [],
    unreadCount: unreadQuery.data?.unreadCount ?? recentQuery.data?.unreadCount ?? 0,
    isLoading: recentQuery.isLoading,
    isError: recentQuery.isError,
    connectionState,
    bellPulse,
    latestRealtimeNotificationId,
    refresh,
  }), [
    bellPulse,
    canRead,
    connectionState,
    latestRealtimeNotificationId,
    recentQuery.data,
    recentQuery.isError,
    recentQuery.isLoading,
    refresh,
    unreadQuery.data,
  ])

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

function getTabId() {
  const key = 'laundry.notifications.tab-id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID?.()
      ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    sessionStorage.setItem(key, id)
  }
  return id
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotificationContext() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotificationContext must be used within NotificationProvider')
  return context
}
