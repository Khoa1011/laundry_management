import type { ReactNode } from 'react'

export function DetailSectionTitle({
  icon,
  title,
  action,
  className = '',
}: {
  icon: ReactNode
  title: ReactNode
  action?: ReactNode
  className?: string
}) {
  return <div className={['detail-section-title', className].filter(Boolean).join(' ')}>
    <span className="detail-section-title__icon" aria-hidden="true">{icon}</span>
    <h2>{title}</h2>
    {action && <div className="detail-section-title__action">{action}</div>}
  </div>
}
