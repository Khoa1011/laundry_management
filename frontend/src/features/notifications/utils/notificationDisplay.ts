import type { TFunction } from 'i18next'
import { formatDateTime } from '../../../utils/dateTime'
import type { NotificationItem } from '../model/types'

export function notificationText(item: NotificationItem, t: TFunction) {
  const interpolation = { ...item.metadata }
  return {
    title: t(item.titleKey, { ...interpolation, defaultValue: item.titleFallback }),
    message: t(item.messageKey, { ...interpolation, defaultValue: item.messageFallback }),
  }
}

export function resolveNotificationRoute(item: NotificationItem): string | null {
  if (!item.referenceType || !item.referenceId) return item.deepLink === '/notifications' ? item.deepLink : null
  const routes: Partial<Record<NonNullable<NotificationItem['referenceType']>, string>> = {
    EMPLOYEE: `/employees/${encodeURIComponent(item.referenceId)}`,
    CUSTOMER: `/customers/${encodeURIComponent(item.referenceId)}`,
    ORDER: `/orders/${encodeURIComponent(item.referenceId)}`,
  }
  const resolved = routes[item.referenceType]
  return resolved && item.deepLink === resolved ? resolved : null
}

export function relativeNotificationTime(value: string, language: string) {
  const instant = new Date(value).getTime()
  const elapsed = Date.now() - instant
  if (!Number.isFinite(instant) || elapsed < 0 || elapsed >= 60 * 60_000) return formatDateTime(value)
  if (elapsed < 60_000) return language.startsWith('en') ? 'Just now' : 'Vừa xong'

  const minutes = Math.floor(elapsed / 60_000)
  return language.startsWith('en') ? `${minutes} min ago` : `${minutes} phút trước`
}
