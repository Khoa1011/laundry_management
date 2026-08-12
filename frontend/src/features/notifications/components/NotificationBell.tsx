import { Bell, CheckCheck, ChevronLeft, Settings2, X } from 'lucide-react'
import { AnimatePresence, m, useAnimationControls } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../../auth/permissionCodes.generated'
import { Button } from '../../../components/ui/Button'
import { IconButton } from '../../../components/ui/IconButton'
import { motionDuration, motionEase } from '../../../providers/motionPresets'
import { useToast } from '../../../providers/ToastProvider'
import { useMarkAllNotificationsRead } from '../hooks/useNotifications'
import { useNotificationContext } from '../providers/NotificationProvider'
import { NotificationItem } from './NotificationItem'
import { NotificationPreferencesPanel } from './NotificationPreferencesPanel'
import { NotificationConnectionStatus } from './NotificationVisuals'

export function NotificationBell() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const {
    canRead,
    unreadCount,
    recentNotifications,
    isLoading,
    isError,
    connectionState,
    bellPulse,
    latestRealtimeNotificationId,
    refresh,
  } = useNotificationContext()
  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const bellControls = useAnimationControls()
  const navigate = useNavigate()
  const { notify } = useToast()
  const markAll = useMarkAllNotificationsRead()
  const canManagePreferences = hasPermission(PERMISSION_CODES.NOTIFICATION_PREFERENCES_MANAGE_OWN)
  const visible = filter === 'UNREAD'
    ? recentNotifications.filter((notification) => notification.unread)
    : recentNotifications

  useEffect(() => {
    if (bellPulse <= 0) return
    void bellControls.start({
      rotate: [0, -5, 4, -2, 0],
      y: [0, -1, 0],
      transition: { duration: motionDuration.emphasis, ease: motionEase },
    })
  }, [bellControls, bellPulse])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const panel = panelRef.current
    const trigger = triggerRef.current
    document.body.style.overflow = 'hidden'
    panel?.querySelector<HTMLElement>('button, a, input, select')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        setSettingsOpen(false)
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])',
      ))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [open])

  if (!canRead) return null

  const markEverythingRead = async () => {
    try {
      await markAll.mutateAsync()
    } catch {
      notify(t('notification:error.markAllRead'), 'error')
    }
  }
  const close = () => {
    setOpen(false)
    setSettingsOpen(false)
  }

  return (
    <>
      <m.span className="notification-bell-motion" animate={bellControls}>
        <IconButton ref={triggerRef} type="button" className="notification-bell"
          onClick={() => {
            if (open) setSettingsOpen(false)
            setOpen((current) => !current)
          }}
          label={t('notification:bellLabel', { count: unreadCount })}
          aria-haspopup="dialog" aria-expanded={open}
          data-connection={connectionState}
          data-has-unread={unreadCount > 0 ? 'true' : 'false'}>
          <Bell size={20} aria-hidden="true" />
          <AnimatePresence initial={false}>
            {unreadCount > 0 && <m.span key={unreadCount} className="notification-bell__badge"
              initial={{ scale: 0.85 }} animate={{ scale: [0.85, 1.08, 1] }} exit={{ scale: 0 }}
              aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</m.span>}
          </AnimatePresence>
        </IconButton>
      </m.span>
      {createPortal(
        <AnimatePresence initial={false}>
          {open && <m.div className="notification-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: motionDuration.primitive }}
            onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
            <m.div ref={panelRef} className="notification-panel" role="dialog" aria-modal="true"
              aria-labelledby="notification-panel-title"
              initial={{ opacity: 0, y: -6, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.99 }} transition={{ duration: motionDuration.overlay }}>
              <header className="notification-panel__header">
                {settingsOpen && <IconButton type="button" onClick={() => setSettingsOpen(false)}
                  label={t('common:back')}><ChevronLeft size={20} aria-hidden="true" /></IconButton>}
                <div>
                  <h2 id="notification-panel-title">{settingsOpen
                    ? t('notification:settings.title') : t('notification:title')}</h2>
                  {!settingsOpen && <p>{t('notification:unreadSummary', { count: unreadCount })}</p>}
                </div>
                <span className="notification-panel__spacer" />
                {!settingsOpen && canManagePreferences && <IconButton type="button" onClick={() => setSettingsOpen(true)}
                  label={t('notification:action.settings')}><Settings2 size={19} aria-hidden="true" /></IconButton>}
                <IconButton type="button" onClick={close} label={t('common:close')}>
                  <X size={20} aria-hidden="true" />
                </IconButton>
              </header>
              {settingsOpen ? <div className="notification-panel__settings"><NotificationPreferencesPanel /></div> : <>
                <div className="notification-panel__toolbar">
                  <div className="segmented-control" aria-label={t('notification:filter.label')}>
                    <Button type="button" variant="ghost" size="sm" className={filter === 'ALL' ? 'active' : ''} onClick={() => setFilter('ALL')}>
                      {t('notification:filter.all')}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className={filter === 'UNREAD' ? 'active' : ''} onClick={() => setFilter('UNREAD')}>
                      {t('notification:filter.unread')}
                    </Button>
                  </div>
                  <NotificationConnectionStatus state={connectionState} />
                </div>
                <div className="notification-panel__list">
                  {isLoading && <NotificationListSkeleton count={4} />}
                  {isError && <div className="notification-inline-state" role="alert">
                    <strong>{t('notification:error.title')}</strong><span>{t('notification:error.description')}</span>
                    <Button type="button" variant="secondary" onClick={() => void refresh()}>
                      {t('notification:action.retry')}
                    </Button>
                  </div>}
                  {!isLoading && !isError && visible.length === 0 && <div className="notification-inline-state">
                    <Bell size={24} aria-hidden="true" />
                    <strong>{filter === 'UNREAD' ? t('notification:empty.unreadTitle') : t('notification:empty.title')}</strong>
                    <span>{filter === 'UNREAD' ? t('notification:empty.unreadDescription') : t('notification:empty.description')}</span>
                  </div>}
                  {visible.map((notification) => <NotificationItem key={notification.id} item={notification}
                    compact realtime={notification.id === latestRealtimeNotificationId} onNavigate={close} />)}
                </div>
                <footer className="notification-panel__footer">
                  <Button type="button" variant="ghost" size="sm" className="text-button notification-panel__mark-all"
                    onClick={() => void markEverythingRead()} disabled={unreadCount === 0 || markAll.isPending}>
                    <CheckCheck size={18} aria-hidden="true" />{t('notification:action.markAllRead')}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => {
                    close()
                    navigate('/notifications')
                  }}>{t('notification:action.viewAll')}</Button>
                </footer>
              </>}
            </m.div>
          </m.div>}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

export function NotificationListSkeleton({ count = 5 }: { count?: number }) {
  return <div className="notification-skeleton-list" aria-label="Loading">
    {Array.from({ length: count }, (_, index) => <span key={index} className="notification-skeleton-row" />)}
  </div>
}
