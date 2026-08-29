import { Bell, CheckCheck, RefreshCw, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../../auth/permissionCodes.generated'
import { Button } from '../../../components/ui/Button'
import { CollapsibleFilterPanel } from '../../../components/ui/CollapsibleFilterPanel'
import { IconButton } from '../../../components/ui/IconButton'
import { useToast } from '../../../providers/ToastProvider'
import { NotificationItem } from '../components/NotificationItem'
import { NotificationListSkeleton } from '../components/NotificationBell'
import { NotificationPreferencesPanel } from '../components/NotificationPreferencesPanel'
import { NotificationConnectionStatus } from '../components/NotificationVisuals'
import { useMarkAllNotificationsRead, useNotifications } from '../hooks/useNotifications'
import type { NotificationListStatus, NotificationSeverity, NotificationType } from '../model/types'
import { useNotificationContext } from '../providers/NotificationProvider'

export function NotificationCenterPage() {
  const { t } = useTranslation()
  const { user, hasPermission } = useAuth()
  const { notify } = useToast()
  const { unreadCount, connectionState, latestRealtimeNotificationId } = useNotificationContext()
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState<NotificationListStatus>('ALL')
  const [severity, setSeverity] = useState<NotificationSeverity | ''>('')
  const [type, setType] = useState<NotificationType | ''>('')
  const [branchId, setBranchId] = useState<number | ''>('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const filters = {
    page,
    size: 20,
    status,
    severity: severity || undefined,
    type: type || undefined,
    branchId: branchId || undefined,
  }
  const query = useNotifications(filters)
  const markAll = useMarkAllNotificationsRead()
  const canManagePreferences = hasPermission(PERMISSION_CODES.NOTIFICATION_PREFERENCES_MANAGE_OWN)
  const activeFilterCount = [status !== 'ALL' ? status : '', severity, type, branchId].filter(Boolean).length

  const markEverythingRead = async () => {
    try {
      await markAll.mutateAsync()
      notify(t('notification:success.markAllRead'), 'success')
    } catch {
      notify(t('notification:error.markAllRead'), 'error')
    }
  }

  return (
    <div className="notification-center">
      <header className="notification-center__header">
        <div>
          <div className="notification-center__title-row">
            <h1>{t('notification:center.title')}</h1>
            <span className="notification-center__unread">{t('notification:unreadSummary', { count: unreadCount })}</span>
          </div>
          <p>{t('notification:center.description')}</p>
          <NotificationConnectionStatus state={connectionState} />
        </div>
        <div className="notification-center__actions">
          <IconButton type="button" onClick={() => void query.refetch()}
            label={t('notification:action.refresh')} title={t('notification:action.refresh')}>
            <RefreshCw size={19} aria-hidden="true" />
          </IconButton>
          {canManagePreferences && <Button type="button" variant="secondary" onClick={() => setSettingsOpen((value) => !value)}>
            <Settings2 size={18} aria-hidden="true" />{t('notification:action.settings')}
          </Button>}
          <Button type="button" onClick={() => void markEverythingRead()}
            disabled={unreadCount === 0 || markAll.isPending}>
            <CheckCheck size={18} aria-hidden="true" />{t('notification:action.markAllRead')}
          </Button>
        </div>
      </header>

      {settingsOpen && <div className="notification-center__settings"><NotificationPreferencesPanel /></div>}

      <CollapsibleFilterPanel className="notification-filter-collapse" fieldsClassName="notification-center__filters"
        label={t('notification:filter.label')} activeCount={activeFilterCount}>
        <div className="segmented-control notification-status-filter">
          {(['ALL', 'UNREAD', 'READ'] as const).map((value) => <Button key={value} type="button" variant="ghost" size="sm"
            className={status === value ? 'active' : ''} onClick={() => { setStatus(value); setPage(0) }}>
            {t(`notification:filter.${value.toLowerCase()}`)}
          </Button>)}
        </div>
        <label><span>{t('notification:filter.severity')}</span><select value={severity}
          onChange={(event) => { setSeverity(event.target.value as NotificationSeverity | ''); setPage(0) }}>
          <option value="">{t('notification:filter.allSeverities')}</option>
          {(['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'ACTION_REQUIRED'] as const).map((value) =>
            <option key={value} value={value}>{t(`notification:severity.${value === 'ACTION_REQUIRED' ? 'actionRequired' : value.toLowerCase()}`)}</option>)}
        </select></label>
        <label><span>{t('notification:filter.type')}</span><select value={type}
          onChange={(event) => { setType(event.target.value as NotificationType | ''); setPage(0) }}>
          <option value="">{t('notification:filter.allTypes')}</option>
          {(['EMPLOYEE_STATUS_CHANGED', 'EMPLOYEE_BRANCH_CHANGED', 'EMPLOYEE_ACCOUNT_LINKED', 'SYSTEM_ANNOUNCEMENT', 'GENERIC_INTERNAL'] as const)
            .map((value) => <option key={value} value={value}>{t(`notification:type.${value}`)}</option>)}
        </select></label>
        {user && user.branches.length > 1 && <label><span>{t('notification:filter.branch')}</span>
          <select value={branchId} onChange={(event) => { setBranchId(event.target.value ? Number(event.target.value) : ''); setPage(0) }}>
            <option value="">{t('notification:filter.allBranches')}</option>
            {user.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select></label>}
      </CollapsibleFilterPanel>

      <section className="notification-center__list" aria-live="polite">
        {query.isLoading && <NotificationListSkeleton count={7} />}
        {query.isError && <div className="notification-page-state" role="alert">
          <Bell size={28} aria-hidden="true" />
          <h2>{t('notification:error.title')}</h2>
          <p>{t('notification:error.description')}</p>
          <Button type="button" variant="secondary" onClick={() => void query.refetch()}>
            {t('notification:action.retry')}
          </Button>
        </div>}
        {!query.isLoading && !query.isError && query.data?.content.length === 0 && <div className="notification-page-state">
          <Bell size={28} aria-hidden="true" />
          <h2>{status === 'UNREAD' ? t('notification:empty.unreadTitle') : t('notification:empty.title')}</h2>
          <p>{status === 'UNREAD' ? t('notification:empty.unreadDescription') : t('notification:empty.description')}</p>
        </div>}
        {query.data?.content.map((notification) =>
          <NotificationItem key={notification.id} item={notification} dismissible
            realtime={notification.id === latestRealtimeNotificationId} />)}
      </section>

      {query.data && query.data.totalPages > 1 && <nav className="notification-pagination" aria-label={t('common:page', {
        current: query.data.page + 1,
        total: query.data.totalPages,
      })}>
        <Button type="button" variant="secondary" disabled={page === 0}
          onClick={() => setPage((value) => Math.max(0, value - 1))}>{t('common:previous')}</Button>
        <span>{t('common:page', { current: query.data.page + 1, total: query.data.totalPages })}</span>
        <Button type="button" variant="secondary" disabled={!query.data.hasNext}
          onClick={() => setPage((value) => value + 1)}>{t('common:next')}</Button>
      </nav>}
    </div>
  )
}
