import type { ElementType, HTMLAttributes, ReactNode } from 'react'

export type StatCardTone = 'primary' | 'operational' | 'success' | 'warning' | 'danger' | 'neutral'

export function StatCard({
  as: Component = 'article',
  icon,
  label,
  value,
  supporting,
  trend,
  tone = 'primary',
  className = '',
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: ElementType
  icon?: ReactNode
  label: ReactNode
  value: ReactNode
  supporting?: ReactNode
  trend?: {
    direction?: 'up' | 'down' | 'neutral'
    value: ReactNode
    label?: ReactNode
  }
  tone?: StatCardTone
}) {
  return (
    <Component
      className={['stat-card', `stat-card--${tone}`, className].filter(Boolean).join(' ')}
      {...props}
    >
      {icon && <span className="stat-card__icon" aria-hidden="true">{icon}</span>}
      <div className="stat-card__content">
        <span className="stat-card__label">{label}</span>
        <div className="stat-card__value-row">
          <strong className="stat-card__value">{value}</strong>
          {trend && (
            <span className={`stat-card__trend stat-card__trend--${trend.direction ?? 'neutral'}`}>
              <span>{trend.value}</span>
              {trend.label && <small>{trend.label}</small>}
            </span>
          )}
        </div>
      </div>
      {supporting && <div className="stat-card__supporting">{supporting}</div>}
    </Component>
  )
}
