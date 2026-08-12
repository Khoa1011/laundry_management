import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  dismissNotification,
  getNotification,
  getNotificationPreferences,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  notificationKeys,
  updateNotificationPreferences,
} from '../api/notificationsApi'
import type { NotificationFilters, NotificationPage, NotificationPreferences } from '../model/types'

export function useNotifications(filters: NotificationFilters, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.list(filters),
    queryFn: () => getNotifications(filters),
    enabled,
  })
}

export function useNotificationDetail(id: number, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.detail(id),
    queryFn: () => getNotification(id),
    enabled,
  })
}

export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: getUnreadNotificationCount,
    enabled,
  })
}

function useRefreshNotificationQueries() {
  const queryClient = useQueryClient()
  return async (unreadCount: number) => {
    queryClient.setQueryData(notificationKeys.unread, { unreadCount })
    await queryClient.invalidateQueries({ queryKey: notificationKeys.all })
  }
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  const refresh = useRefreshNotificationQueries()
  return useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (id) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['notifications', 'list'] }),
        queryClient.cancelQueries({ queryKey: notificationKeys.unread }),
      ])
      const listSnapshots = queryClient.getQueriesData<NotificationPage>({
        queryKey: ['notifications', 'list'],
      })
      const unreadSnapshot = queryClient.getQueryData<{ unreadCount: number }>(notificationKeys.unread)
      const wasUnread = listSnapshots.some(([, page]) =>
        page?.content.some((item) => item.id === id && item.unread))
      queryClient.setQueriesData<NotificationPage>({ queryKey: ['notifications', 'list'] }, (page) => page ? {
        ...page,
        content: page.content.map((item) => item.id === id
          ? { ...item, unread: false, readAt: item.readAt ?? new Date().toISOString() }
          : item),
        unreadCount: Math.max(0, page.unreadCount - (page.content.some((item) => item.id === id && item.unread) ? 1 : 0)),
      } : page)
      if (unreadSnapshot && wasUnread) {
        queryClient.setQueryData(notificationKeys.unread, {
          unreadCount: Math.max(0, unreadSnapshot.unreadCount - 1),
        })
      }
      return { listSnapshots, unreadSnapshot }
    },
    onError: (_error, _id, context) => {
      context?.listSnapshots.forEach(([key, value]) => queryClient.setQueryData(key, value))
      if (context?.unreadSnapshot) {
        queryClient.setQueryData(notificationKeys.unread, context.unreadSnapshot)
      }
    },
    onSuccess: (response) => void refresh(response.unreadCount),
  })
}

export function useMarkAllNotificationsRead() {
  const refresh = useRefreshNotificationQueries()
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: (response) => void refresh(response.unreadCount),
  })
}

export function useDismissNotification() {
  const refresh = useRefreshNotificationQueries()
  return useMutation({
    mutationFn: dismissNotification,
    onSuccess: (response) => void refresh(response.unreadCount),
  })
}

export function useNotificationPreferences(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: getNotificationPreferences,
    enabled,
  })
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (preferences: Omit<NotificationPreferences, 'version'>) =>
      updateNotificationPreferences(preferences),
    onSuccess: (preference) => queryClient.setQueryData(notificationKeys.preferences, preference),
  })
}
