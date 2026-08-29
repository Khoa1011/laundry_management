import { CaretDownIcon, FunnelSimpleIcon } from '@phosphor-icons/react'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type CollapsibleFilterPanelProps = {
  activeCount?: number
  children: ReactNode
  className?: string
  defaultOpen?: boolean
  fieldsClassName?: string
  label: string
}

export function CollapsibleFilterPanel({
  activeCount = 0,
  children,
  className = '',
  defaultOpen = false,
  fieldsClassName = '',
  label,
}: CollapsibleFilterPanelProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <div className={['collapsible-filter', className].filter(Boolean).join(' ')} data-open={open}>
      <button
        type="button"
        className="collapsible-filter__toggle"
        aria-controls={contentId}
        aria-expanded={open}
        aria-label={`${open ? t('hideFilters') : t('showFilters')}: ${label}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="collapsible-filter__visual" aria-hidden="true">
          <FunnelSimpleIcon size={22} weight="fill" />
        </span>
        <span className="collapsible-filter__title">{label}</span>
        {activeCount > 0 && <span className="collapsible-filter__count" aria-label={t('activeFilterCount', { count: activeCount })}>{activeCount}</span>}
        <CaretDownIcon className="collapsible-filter__chevron" size={18} weight="bold" aria-hidden="true" />
      </button>
      <div
        id={contentId}
        className="collapsible-filter__body"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="collapsible-filter__body-inner">
          <div className={['collapsible-filter__fields', fieldsClassName].filter(Boolean).join(' ')}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
