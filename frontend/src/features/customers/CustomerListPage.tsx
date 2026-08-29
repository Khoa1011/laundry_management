import { PencilSimpleIcon, UserCircleIcon } from '@phosphor-icons/react'
import { ChevronLeft, ChevronRight, Mail, Phone, Plus, Search, SlidersHorizontal, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import type { CustomerListItem, CustomerSource, CustomerStatus } from '../../api/types'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { ErrorState, LoadingState, PermissionDeniedState, StatePanel } from '../../components/States'
import { Button, ButtonLink } from '../../components/ui/Button'
import { ActionMenu as FloatingActionMenu } from '../../components/ui/ActionMenu'
import { CollapsibleFilterPanel } from '../../components/ui/CollapsibleFilterPanel'
import { IconButton } from '../../components/ui/IconButton'
import { useCustomers, type CustomerFilters } from './api'
import { formatDate, initials, sourceLabel, statusLabel, typeLabel } from './format'
import { QuickCustomerDialog } from './QuickCustomerDialog'

const sources: CustomerSource[] = ['WALK_IN', 'REFERRAL', 'FACEBOOK', 'ZALO', 'GOOGLE', 'WEBSITE', 'PARTNER', 'OTHER']

function valueOf<T extends string>(value: string | null, allowed: readonly T[]): '' | T {
  return value && allowed.includes(value as T) ? value as T : ''
}

export function CustomerListPage() {
  const { t, i18n } = useTranslation()
  const { branchId, hasPermission } = useAuth()
  const [params, setParams] = useSearchParams()
  const [quickOpen, setQuickOpen] = useState(false)
  const searchParam = params.get('search') ?? ''
  const [searchInput, setSearchInput] = useState(searchParam)
  const canRead = hasPermission(PERMISSION_CODES.CUSTOMER_READ)
  const canCreate = hasPermission(PERMISSION_CODES.CUSTOMER_CREATE)
  const canUpdate = hasPermission(PERMISSION_CODES.CUSTOMER_UPDATE)

  useEffect(() => setSearchInput(searchParam), [searchParam])
  useEffect(() => {
    if (searchInput === searchParam) return
    const timeout = window.setTimeout(() => {
      setParams((current) => {
        const next = new URLSearchParams(current)
        const trimmed = searchInput.trim()
        if (trimmed) next.set('search', trimmed); else next.delete('search')
        next.set('page', '0')
        return next
      }, { replace: true })
    }, 400)
    return () => window.clearTimeout(timeout)
  }, [searchInput, searchParam, setParams])

  const filters = useMemo<CustomerFilters>(() => ({
    page: Math.max(0, Number(params.get('page')) || 0),
    size: 20,
    search: searchParam,
    status: valueOf(params.get('status'), ['ACTIVE', 'INACTIVE'] as const),
    customerType: valueOf(params.get('customerType'), ['INDIVIDUAL', 'BUSINESS'] as const),
    source: valueOf(params.get('source'), sources),
    sort: params.get('sort') ?? 'updatedAt,desc',
    branchId: branchId ?? 0,
  }), [params, searchParam, branchId])
  const query = useCustomers(filters)
  const appliedCount = [filters.status, filters.customerType, filters.source, filters.sort !== 'updatedAt,desc' ? filters.sort : ''].filter(Boolean).length
  const hasFilters = Boolean(searchParam || appliedCount)

  const patchFilters = (updates: Record<string, string>) => setParams((current) => {
    const next = new URLSearchParams(current)
    Object.entries(updates).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key) })
    next.set('page', '0')
    return next
  })
  const clearFilters = () => { setSearchInput(''); setParams({ page: '0' }, { replace: true }) }

  if (!canRead) return <div className="page-container"><PermissionDeniedState body={t('permissions:customersRead')} /></div>
  const forbidden = query.error instanceof ApiError && query.error.status === 403

  return <div className="page-container customer-list-page">
    <header className="page-header"><div><p className="eyebrow">{t('navigation:customers')}</p><h1>{t('customers:title')}</h1><p>{t('customers:subtitle')}</p></div><div className="page-header__actions">{canCreate && <><Button type="button" variant="create" className="quick-create-desktop" onClick={() => setQuickOpen(true)}><Plus size={18} aria-hidden="true" />{t('customers:quickAdd')}</Button><ButtonLink to="/customers/new" variant="create"><Plus size={18} aria-hidden="true" />{t('customers:add')}</ButtonLink></>}</div></header>
    <section className="filter-panel" aria-label={t('customers:filters')}>
      <label className="search-input"><Search size={19} aria-hidden="true" /><span className="sr-only">{t('search')}</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('customers:searchPlaceholder')} /></label>
      <CollapsibleFilterPanel label={t('customers:filters')} activeCount={appliedCount} fieldsClassName="customer-filter-fields"><Filters filters={filters} patch={patchFilters} t={t} />{hasFilters && <Button variant="ghost" size="sm" className="text-button" type="button" onClick={clearFilters}>{t('clear')}</Button>}</CollapsibleFilterPanel>
    </section>
    {hasFilters && <div className="active-filter-chips">{filters.status && <FilterChip label={statusLabel(filters.status, t)} onClear={() => patchFilters({ status: '' })} />}{filters.customerType && <FilterChip label={typeLabel(filters.customerType, t)} onClear={() => patchFilters({ customerType: '' })} />}{filters.source && <FilterChip label={sourceLabel(filters.source, t)} onClear={() => patchFilters({ source: '' })} />}<Button variant="ghost" size="sm" className="text-button" onClick={clearFilters}>{t('clear')}</Button></div>}
    <div className="list-meta"><strong>{query.data ? t('customers:count', { count: query.data.totalElements }) : t('loading')}</strong>{query.isFetching && query.data && <span className="subtle-progress" role="status">{t('loading')}</span>}</div>
    {forbidden ? <PermissionDeniedState /> : query.isPending ? <LoadingState rows={6} /> : query.isError ? <ErrorState title={query.error instanceof ApiError && query.error.status === 0 ? t('errors:networkTitle') : t('customers:loadErrorTitle')} body={query.error instanceof ApiError && query.error.status === 0 ? t('errors:networkBody') : t('customers:loadErrorBody')} onRetry={() => void query.refetch()} /> : query.data.items.length === 0 ? <StatePanel icon={hasFilters ? <SlidersHorizontal /> : <Users />} title={hasFilters ? t('customers:filteredEmptyTitle') : t('customers:emptyTitle')} body={hasFilters ? t('customers:filteredEmptyBody') : t('customers:emptyBody')} action={hasFilters ? <Button variant="secondary" onClick={clearFilters}>{t('clear')}</Button> : canCreate ? <ButtonLink to="/customers/new" variant="create"><Plus size={18} aria-hidden="true" />{t('customers:add')}</ButtonLink> : undefined} /> : <>
      <div className="customer-table-wrap desktop-data-view"><table className="customer-table"><thead><tr><th>{t('customers:customer')}</th><th>{t('customers:phone')}</th><th>{t('customers:type')}</th><th>{t('customers:source')}</th><th>{t('status')}</th><th>{t('customers:created')}</th><th>{t('customers:updated')}</th><th><span className="sr-only">{t('actions')}</span></th></tr></thead><tbody>{query.data.items.map((customer) => <CustomerRow key={customer.id} customer={customer} canUpdate={canUpdate} language={i18n.language} t={t} />)}</tbody></table></div>
      <div className="customer-card-list mobile-data-view">{query.data.items.map((customer) => <CustomerCard key={customer.id} customer={customer} canUpdate={canUpdate} language={i18n.language} t={t} />)}</div>
      <Pagination page={query.data.page} totalPages={query.data.totalPages} onPage={(page) => setParams((current) => { const next = new URLSearchParams(current); next.set('page', String(page)); return next })} t={t} />
    </>}
    <QuickCustomerDialog open={quickOpen} onClose={() => setQuickOpen(false)} />
  </div>
}

function Filters({ filters, patch, t }: { filters: CustomerFilters; patch: (updates: Record<string, string>) => void; t: ReturnType<typeof useTranslation>['t'] }) {
  return <><label><span className="sr-only">{t('status')}</span><select value={filters.status} onChange={(e) => patch({ status: e.target.value })}><option value="">{t('customers:allStatuses')}</option><option value="ACTIVE">{t('active')}</option><option value="INACTIVE">{t('inactive')}</option></select></label><label><span className="sr-only">{t('customers:type')}</span><select value={filters.customerType} onChange={(e) => patch({ customerType: e.target.value })}><option value="">{t('customers:allTypes')}</option><option value="INDIVIDUAL">{t('individual')}</option><option value="BUSINESS">{t('business')}</option></select></label><label><span className="sr-only">{t('customers:source')}</span><select value={filters.source} onChange={(e) => patch({ source: e.target.value })}><option value="">{t('customers:allSources')}</option>{sources.map((source) => <option key={source} value={source}>{sourceLabel(source, t)}</option>)}</select></label><label><span className="sr-only">{t('customers:sort')}</span><select value={filters.sort} onChange={(e) => patch({ sort: e.target.value })}><option value="updatedAt,desc">{t('customers:newest')}</option><option value="createdAt,asc">{t('customers:oldest')}</option><option value="fullName,asc">{t('customers:nameAsc')}</option><option value="customerCode,asc">{t('customers:codeAsc')}</option></select></label></>
}

function CustomerRow({ customer, canUpdate, language, t }: { customer: CustomerListItem; canUpdate: boolean; language: string; t: ReturnType<typeof useTranslation>['t'] }) {
  return <tr><td><Link className="customer-cell" to={`/customers/${customer.id}`}><span className="avatar">{initials(customer.fullName)}</span><span><strong title={customer.fullName}>{customer.fullName}</strong><small title={customer.email ?? undefined}>{customer.customerCode}{customer.email ? ` · ${customer.email}` : ''}</small></span></Link></td><td>{customer.phone}</td><td><span className={`badge badge--type-${customer.customerType.toLowerCase()}`}>{typeLabel(customer.customerType, t)}</span></td><td>{sourceLabel(customer.source, t)}</td><td><StatusBadge status={customer.status} t={t} /></td><td>{formatDate(customer.createdAt, language)}</td><td>{formatDate(customer.updatedAt, language)}</td><td><ActionMenu customer={customer} canUpdate={canUpdate} t={t} /></td></tr>
}

function CustomerCard({ customer, canUpdate, language, t }: { customer: CustomerListItem; canUpdate: boolean; language: string; t: ReturnType<typeof useTranslation>['t'] }) {
  return <article className="customer-card"><Link className="customer-card__main" to={`/customers/${customer.id}`}><span className="avatar avatar--large">{initials(customer.fullName)}</span><span className="customer-card__identity"><strong>{customer.fullName}</strong><small>{customer.customerCode}</small></span><StatusBadge status={customer.status} t={t} /><span className="customer-card__line"><Phone size={16} />{customer.phone}</span>{customer.email && <span className="customer-card__line"><Mail size={16} />{customer.email}</span>}<span className="customer-card__badges"><span className={`badge badge--type-${customer.customerType.toLowerCase()}`}>{typeLabel(customer.customerType, t)}</span><span>{sourceLabel(customer.source, t)}</span></span><small className="customer-card__updated">{t('customers:updated')}: {formatDate(customer.updatedAt, language)}</small></Link><ActionMenu customer={customer} canUpdate={canUpdate} t={t} /></article>
}

function StatusBadge({ status, t }: { status: CustomerStatus; t: ReturnType<typeof useTranslation>['t'] }) { return <span className={`badge badge--status-${status.toLowerCase()}`}><span className="badge__dot" />{statusLabel(status, t)}</span> }

function ActionMenu({ customer, canUpdate, t }: { customer: CustomerListItem; canUpdate: boolean; t: ReturnType<typeof useTranslation>['t'] }) {
  return <FloatingActionMenu label={t('openMenu')}><Link role="menuitem" to={`/customers/${customer.id}`}><UserCircleIcon size={27} weight="fill" aria-hidden="true" /><span className="action-menu__label">{t('customers:view')}</span></Link>{canUpdate && <Link role="menuitem" to={`/customers/${customer.id}/edit`}><PencilSimpleIcon size={26} weight="fill" aria-hidden="true" /><span className="action-menu__label">{t('edit')}</span></Link>}</FloatingActionMenu>
}

function Pagination({ page, totalPages, onPage, t }: { page: number; totalPages: number; onPage: (page: number) => void; t: ReturnType<typeof useTranslation>['t'] }) {
  if (totalPages <= 1) return null
  return <nav className="pagination" aria-label={t('page', { current: page + 1, total: totalPages })}><IconButton variant="secondary" onClick={() => onPage(page - 1)} disabled={page === 0} label={t('previous')}><ChevronLeft size={18} /></IconButton><span>{t('page', { current: page + 1, total: totalPages })}</span><IconButton variant="secondary" onClick={() => onPage(page + 1)} disabled={page + 1 >= totalPages} label={t('next')}><ChevronRight size={18} /></IconButton></nav>
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) { return <button type="button" className="filter-chip" onClick={onClear}>{label}<span aria-hidden="true">×</span></button> }
