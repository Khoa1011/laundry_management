import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../../auth/permissionCodes.generated'
import { useRealtime } from '../../../realtime/context'
import { useToast } from '../../../providers/ToastProvider'
import { notificationKeys } from '../api/notificationsApi'
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

const RECENT_FILTERS = { page: 0, size: 10, status: 'ALL' as const }
const MAX_EVENT_IDS = 240
const SOUND_COOLDOWN_MS = 4_000
const AUDIO_LOCK_KEY = 'laundry.notifications.audio-lock'
const NOTIFICATION_CHANNEL_NAME = 'laundry-notification-effects'

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
  { type: 'effect-seen'; eventId: string; userId?: number }

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
  const { connectionState, subscribe } = useRealtime()
  const userId = user?.id ?? null
  const canRead = Boolean(user) && hasPermission(PERMISSION_CODES.NOTIFICATION_READ_OWN)
  const canManagePreferences = Boolean(user)
    && hasPermission(PERMISSION_CODES.NOTIFICATION_PREFERENCES_MANAGE_OWN)
  const recentQuery = useNotifications(RECENT_FILTERS, canRead)
  const unreadQuery = useUnreadNotificationCount(canRead)
  useNotificationPreferences(canManagePreferences)
  const [bellPulse, setBellPulse] = useState(0)
  const [latestRealtimeNotificationId, setLatestRealtimeNotificationId] = useState<number | null>(null)
  const effectIds = useRef(new Set<string>())
  const effectOrder = useRef<string[]>([])
  const broadcastChannel = useRef<BroadcastChannel | null>(null)
  const pendingBatch = useRef<Array<{ eventId: string; item: NotificationItem }>>([])
  const batchTimer = useRef<number | null>(null)
  const lastSoundAt = useRef(0)

  useEffect(() => {
    if (!userId) return
    void notificationSoundEngine.prepareStoredCustomSound(`user:${userId}`)
  }, [userId])

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
          `user:${userId ?? 'device'}`,
        )
      },
    })
  }, [notify, t, userId])

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
        `user:${userId ?? 'device'}`,
      )
      if (result === 'blocked') showAudioUnlock(preferences)
    }
  }, [claimAudio, notify, queryClient, showAudioUnlock, t, userId])

  const queueRealtimeEffect = useCallback((eventId: string, item: NotificationItem) => {
    if (!rememberBounded(effectIds.current, effectOrder.current, eventId)) return
    pendingBatch.current.push({ eventId, item })
    if (batchTimer.current === null) {
      batchTimer.current = window.setTimeout(() => { void flushRealtimeBatch() }, 350)
    }
    broadcastChannel.current?.postMessage({ type: 'effect-seen', eventId, userId: userId ?? undefined })
  }, [flushRealtimeBatch, userId])

  const handleEvent = useCallback((event: NotificationSseEnvelope) => {
    if (typeof event.unreadCount === 'number') {
      queryClient.setQueryData(notificationKeys.unread, { unreadCount: event.unreadCount })
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
          return mergeCreatedNotification(current, item, event.unreadCount ?? null)
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
  }, [queryClient, queueRealtimeEffect])

  useEffect(() => {
    if (!canRead || typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(NOTIFICATION_CHANNEL_NAME)
    broadcastChannel.current = channel
    channel.onmessage = (message: MessageEvent<NotificationBroadcastMessage>) => {
      if (message.data.userId && message.data.userId !== userId) return
      if (message.data.type === 'effect-seen') {
        rememberBounded(effectIds.current, effectOrder.current, message.data.eventId)
      }
    }
    return () => {
      channel.close()
      broadcastChannel.current = null
    }
  }, [canRead, userId])

  useEffect(() => subscribe('notification.', (event) => {
    handleEvent(event as NotificationSseEnvelope)
  }), [handleEvent, subscribe])

  useEffect(() => subscribe('realtime.reconnected', () => {
    void refresh()
  }), [refresh, subscribe])

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
