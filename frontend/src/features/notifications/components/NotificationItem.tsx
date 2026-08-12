import { ChevronRight, X } from 'lucide-react'
import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { useToast } from '../../../providers/ToastProvider'
import { IconButton } from '../../../components/ui/IconButton'
import { usePressRipple } from '../../../components/motion/LiquidRipple'
import { motionDuration } from '../../../providers/motionPresets'
import { useDismissNotification, useMarkNotificationRead } from '../hooks/useNotifications'
import type { NotificationItem as NotificationItemModel } from '../model/types'
import { notificationText, relativeNotificationTime, resolveNotificationRoute } from '../utils/notificationDisplay'
import { NotificationSeverityBadge, NotificationSeverityIcon } from './NotificationVisuals'

export function NotificationItem({
  item,
  compact = false,
  dismissible = false,
  realtime = false,
  onNavigate,
}: {
  item: NotificationItemModel
  compact?: boolean
  dismissible?: boolean
  realtime?: boolean
  onNavigate?: () => void
}) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const markRead = useMarkNotificationRead()
  const dismiss = useDismissNotification()
  const press = usePressRipple<HTMLButtonElement>()
  const text = notificationText(item, t)
  const branchName = user?.branches.find((branch) => branch.id === item.branchId)?.name

  const open = async () => {
    if (item.unread) {
      try {
        await markRead.mutateAsync(item.id)
      } catch {
        notify(t('notification:error.markRead'), 'error')
        return
      }
    }
    const route = resolveNotificationRoute(item)
    if (!route) {
      notify(t('notification:noLinkedRoute'), 'info')
      return
    }
    onNavigate?.()
    navigate(route)
  }

  const hide = async () => {
    try {
      await dismiss.mutateAsync(item.id)
    } catch {
      notify(t('notification:error.dismiss'), 'error')
    }
  }

  return (
    <m.article layout className={`notification-item${item.unread ? ' notification-item--unread' : ''}${compact ? ' notification-item--compact' : ''}${realtime ? ' notification-item--realtime' : ''}`}
      initial={realtime ? { opacity: 0.82, y: -4 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: motionDuration.primitive }}
      data-realtime={realtime ? 'true' : undefined}>
      <button ref={press.ref} type="button" className="notification-item__main" data-liquid-managed="true"
        onPointerDown={press.onPointerDown} onPointerUp={press.onPointerUp}
        onPointerCancel={press.onPointerCancel} onPointerLeave={press.onPointerLeave}
        onKeyDown={press.onKeyDown} onKeyUp={press.onKeyUp} onBlur={press.onBlur}
        onClick={() => void open()}>
        <span className={`notification-item__icon notification-item__icon--${item.severity.toLowerCase()}`}>
          <NotificationSeverityIcon severity={item.severity} />
        </span>
        <span className="notification-item__content">
          <span className="notification-item__title">
            {text.title}
            {item.unread && <span className="notification-unread-dot">
              <span className="sr-only">{t('notification:state.unread')}</span>
            </span>}
          </span>
          <span className="notification-item__message">{text.message}</span>
          <span className="notification-item__meta">
            <time dateTime={item.createdAt}>{relativeNotificationTime(item.createdAt, i18n.language)}</time>
            {branchName && <span>{branchName}</span>}
            {!compact && <NotificationSeverityBadge severity={item.severity} />}
          </span>
        </span>
        {resolveNotificationRoute(item) && <ChevronRight className="notification-item__chevron" size={18} aria-hidden="true" />}
      </button>
      {dismissible && <IconButton type="button" size="sm" className="notification-item__dismiss"
        onClick={() => void hide()} disabled={dismiss.isPending} label={t('notification:action.dismiss')}>
        <X size={17} aria-hidden="true" />
      </IconButton>}
    </m.article>
  )
}
