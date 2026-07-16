import { CircleAlert, Inbox, LockKeyhole, SearchX, UserRoundX } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export function LoadingState({ rows = 4 }: { rows?: number }) {
  const { t } = useTranslation()
  return <div className="skeleton-list" aria-label={t('loading')} aria-busy="true">{Array.from({ length: rows }, (_, index) => <div className="skeleton-card" key={index}><span /><span /><span /></div>)}</div>
}

export function StatePanel({ icon, title, body, action, compact = false }: { icon?: ReactNode; title: string; body: string; action?: ReactNode; compact?: boolean }) {
  return <section className={`state-panel${compact ? ' state-panel--compact' : ''}`}><div className="state-panel__icon" aria-hidden="true">{icon ?? <Inbox />}</div><h2>{title}</h2><p>{body}</p>{action && <div className="state-panel__action">{action}</div>}</section>
}

export function ErrorState({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  return <StatePanel icon={<CircleAlert />} title={title} body={body} action={onRetry ? <button className="button button--secondary" onClick={onRetry}>{t('retry')}</button> : undefined} />
}

export function PermissionDeniedState({ body }: { body?: string }) {
  const { t } = useTranslation()
  return <StatePanel icon={<LockKeyhole />} title={t('permissions:title')} body={body ?? t('permissions:body')} />
}

export function NotFoundState({ customer = false }: { customer?: boolean }) {
  const { t } = useTranslation()
  return <StatePanel icon={customer ? <UserRoundX /> : <SearchX />} title={customer ? t('customers:notFoundTitle') : t('errors:genericTitle')} body={customer ? t('customers:notFoundBody') : t('errors:genericBody')} action={<a className="button button--secondary" href="/customers">{t('goHome')}</a>} />
}
