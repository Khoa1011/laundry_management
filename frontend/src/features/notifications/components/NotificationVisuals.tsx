import { AlertTriangle, BellRing, CheckCircle2, CircleAlert, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NotificationConnectionState, NotificationSeverity } from '../model/types'

export function NotificationSeverityIcon({ severity, size = 19 }: { severity: NotificationSeverity; size?: number }) {
  const Icon = severity === 'SUCCESS' ? CheckCircle2
    : severity === 'WARNING' ? AlertTriangle
      : severity === 'ERROR' ? CircleAlert
        : severity === 'ACTION_REQUIRED' ? BellRing : Info
  return <Icon size={size} aria-hidden="true" />
}

export function NotificationSeverityBadge({ severity }: { severity: NotificationSeverity }) {
  const { t } = useTranslation()
  return (
    <span className={`notification-severity notification-severity--${severity.toLowerCase()}`}>
      <NotificationSeverityIcon severity={severity} size={14} />
      {t(`notification:severity.${severity === 'ACTION_REQUIRED' ? 'actionRequired' : severity.toLowerCase()}`)}
    </span>
  )
}

export function NotificationConnectionStatus({ state }: { state: NotificationConnectionState }) {
  const { t } = useTranslation()
  if (state === 'idle' || state === 'connected') return null
  return (
    <span className={`notification-connection notification-connection--${state}`} role="status">
      <span aria-hidden="true" />
      {t(`notification:connection.${state}`)}
    </span>
  )
}
