import type { TFunction } from 'i18next'
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
  const elapsedSeconds = Math.round((new Date(value).getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(language.startsWith('en') ? 'en' : 'vi', { numeric: 'auto' })
  const absolute = Math.abs(elapsedSeconds)
  if (absolute < 60) return formatter.format(elapsedSeconds, 'second')
  const minutes = Math.round(elapsedSeconds / 60)
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour')
  return formatter.format(Math.round(hours / 24), 'day')
}
