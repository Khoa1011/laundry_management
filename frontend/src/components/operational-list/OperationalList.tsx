import { Check, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { Button } from '../ui/Button'
import { Surface } from '../ui/Surface'

export function OperationalListShell({ className = '', children }: { className?: string; children: ReactNode }) {
  return <Surface className={['operational-list', className].filter(Boolean).join(' ')}>{children}</Surface>
}

export function OperationalListHeader({ icon, title, subtitle, totalLabel = 'Tổng cộng', totalValue, action }: {
  icon: ReactNode
  title: string
  subtitle: string
  totalLabel?: string
  totalValue: ReactNode
  action?: ReactNode
}) {
  return <header className="operational-list__header">
    <div className="operational-list__identity">
      <span className="operational-list__icon" aria-hidden="true">{icon}</span>
      <div><h1>{title}</h1><p>{subtitle}</p></div>
    </div>
    <div className="operational-list__header-actions">
      <div className="operational-list__total"><span>{totalLabel}</span><strong>{totalValue}</strong></div>
      {action}
    </div>
  </header>
}

export function OperationalSearch({ label, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className={['operational-list__search', className].filter(Boolean).join(' ')}>
    <Search size={19} aria-hidden="true" />
    <span className="sr-only">{label}</span>
    <input type="search" {...props} />
  </label>
}

export type OperationalStatusTab<T extends string> = {
  value: T
  label: string
  icon?: ReactNode
  count?: number
  tone?: string
}

export function OperationalStatusTabs<T extends string>({ tabs, value, onChange, label }: {
  tabs: Array<OperationalStatusTab<T>>
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return <div className="operational-status-tabs" role="tablist" aria-label={label}>
    {tabs.map((tab) => <button
      key={tab.value}
      type="button"
      role="tab"
      data-tone={tab.tone}
      aria-selected={value === tab.value}
      onClick={() => onChange(tab.value)}
    >
      {tab.icon && <span className="operational-status-tabs__icon" aria-hidden="true">{tab.icon}</span>}
      <span>{tab.label}</span>
      <span
        className={`operational-status-tabs__count${tab.count === undefined ? ' operational-status-tabs__count--placeholder' : ''}`}
        {...(tab.count === undefined ? { 'aria-hidden': true } : { 'aria-label': `${tab.count} bản ghi` })}
      >{tab.count ?? 0}</span>
    </button>)}
  </div>
}

export function SelectionCheckbox({ checked, indeterminate = false, label, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked'> & {
  checked: boolean
  indeterminate?: boolean
  label: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return <label className="selection-checkbox">
    <input ref={ref} type="checkbox" checked={checked} aria-label={label} {...props} />
    <span aria-hidden="true"><Check size={14} /></span>
  </label>
}

export function BulkActionBar({ count, children, onClear, noun }: {
  count: number
  children?: ReactNode
  onClear: () => void
  noun: string
}) {
  if (!count) return null
  return <div className="operational-bulk-bar" role="region" aria-label={`Thao tác với ${count} ${noun} đã chọn`}>
    <strong><Check size={17} aria-hidden="true" />{count} đã chọn</strong>
    <div className="operational-bulk-bar__actions">{children}<Button type="button" size="sm" variant="ghost" onClick={onClear}>Bỏ chọn</Button></div>
  </div>
}

function paginationItems(page: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index)
  const values = new Set([0, totalPages - 1, page - 1, page, page + 1].filter((item) => item >= 0 && item < totalPages))
  return [...values].sort((a, b) => a - b)
}

export function OperationalPagination({ page, size, totalElements, totalPages, noun, onPage, onSize }: {
  page: number
  size: number
  totalElements: number
  totalPages: number
  noun: string
  onPage: (page: number) => void
  onSize: (size: number) => void
}) {
  const pages = useMemo(() => paginationItems(page, totalPages), [page, totalPages])
  const from = totalElements ? page * size + 1 : 0
  const to = Math.min((page + 1) * size, totalElements)
  return <footer className="operational-pagination">
    <label>Hiển thị <select value={size} onChange={(event) => onSize(Number(event.target.value))} aria-label={`Số ${noun} trên mỗi trang`}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select> dòng trên trang</label>
    <span className="operational-pagination__summary">{from}–{to} của {totalElements} {noun}</span>
    <nav aria-label={`Phân trang ${noun}`}>
      <Button type="button" size="sm" variant="ghost" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Trang trước"><ChevronLeft size={18} /></Button>
      {pages.map((item, index) => <span key={item} className="operational-pagination__page-slot">
        {index > 0 && item - pages[index - 1] > 1 && <span aria-hidden="true">…</span>}
        <button type="button" aria-current={item === page ? 'page' : undefined} onClick={() => onPage(item)}>{item + 1}</button>
      </span>)}
      <Button type="button" size="sm" variant="ghost" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)} aria-label="Trang sau"><ChevronRight size={18} /></Button>
    </nav>
  </footer>
}
