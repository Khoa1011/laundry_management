import { apiRequest, readSession, refreshSession } from '../../../api/client'
import type {
  NotificationFilters,
  NotificationItem,
  NotificationMutationResponse,
  NotificationPage,
  NotificationPreferences,
  NotificationSseEnvelope,
} from '../model/types'

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (filters: NotificationFilters) => ['notifications', 'list', filters] as const,
  recent: ['notifications', 'list', { page: 0, size: 10, status: 'ALL' }] as const,
  detail: (id: number) => ['notifications', 'detail', id] as const,
  unread: ['notifications', 'unread-count'] as const,
  preferences: ['notifications', 'preferences'] as const,
}

function queryString(filters: NotificationFilters) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  return params.toString()
}

export function getNotifications(filters: NotificationFilters) {
  return apiRequest<NotificationPage>(`/api/notifications?${queryString(filters)}`)
}

export function getNotification(id: number) {
  return apiRequest<NotificationItem>(`/api/notifications/${id}`)
}

export function getUnreadNotificationCount() {
  return apiRequest<{ unreadCount: number }>('/api/notifications/unread-count')
}

export function markNotificationRead(id: number) {
  return apiRequest<NotificationMutationResponse>(`/api/notifications/${id}/read`, { method: 'PATCH' })
}

export function markAllNotificationsRead() {
  return apiRequest<NotificationMutationResponse>('/api/notifications/read-all', { method: 'PATCH' })
}

export function dismissNotification(id: number) {
  return apiRequest<NotificationMutationResponse>(`/api/notifications/${id}/dismiss`, { method: 'PATCH' })
}

export function getNotificationPreferences() {
  return apiRequest<NotificationPreferences>('/api/notifications/preferences')
}

export function updateNotificationPreferences(preferences: Omit<NotificationPreferences, 'version'>) {
  return apiRequest<NotificationPreferences>('/api/notifications/preferences', {
    method: 'PUT',
    body: preferences,
  })
}

interface StreamHandlers {
  onOpen: () => void
  onEvent: (event: NotificationSseEnvelope) => void
}

export class NotificationStreamError extends Error {
  status: number | null
  retryable: boolean

  constructor(message: string, options: { status?: number | null; retryable: boolean }) {
    super(message)
    this.name = 'NotificationStreamError'
    this.status = options.status ?? null
    this.retryable = options.retryable
  }
}

export function isRetryableNotificationStreamError(error: unknown) {
  if (error instanceof NotificationStreamError) return error.retryable
  return true
}

function streamErrorForStatus(status: number) {
  const retryable = status === 408 || status === 429 || status >= 500
  return new NotificationStreamError(`SSE_${status}`, { status, retryable })
}

export async function openNotificationStream(signal: AbortSignal, handlers: StreamHandlers) {
  let session = readSession()
  if (!session) throw new NotificationStreamError('AUTH_REQUIRED', { status: 401, retryable: false })
  let response = await fetch('/api/notifications/stream', {
    method: 'GET',
    signal,
    credentials: 'same-origin',
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${session.accessToken}`,
    },
  })
  if (response.status === 401 && !signal.aborted) {
    session = await refreshSession()
    if (!session) throw new NotificationStreamError('AUTH_REQUIRED', { status: 401, retryable: false })
    response = await fetch('/api/notifications/stream', {
      method: 'GET',
      signal,
      credentials: 'same-origin',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${session.accessToken}`,
      },
    })
  }
  if (!response.ok) throw streamErrorForStatus(response.status)
  if (!response.body) throw new NotificationStreamError('SSE_NO_BODY', { retryable: true })
  handlers.onOpen()

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (!signal.aborted) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      const parsed = parseSseBlock(block)
      if (parsed) handlers.onEvent(parsed)
      boundary = buffer.indexOf('\n\n')
    }
  }
}

function parseSseBlock(block: string): NotificationSseEnvelope | null {
  let id = ''
  const data: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('id:')) id = line.slice(3).trim()
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
  }
  if (data.length === 0) return null
  try {
    const parsed = JSON.parse(data.join('\n')) as NotificationSseEnvelope
    return parsed.eventId ? parsed : { ...parsed, eventId: id }
  } catch {
    return null
  }
}
