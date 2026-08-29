import { PencilSimpleIcon, UserCircleIcon } from '@phosphor-icons/react'
import { BriefcaseBusiness, Building2, ChevronLeft, ChevronRight, Mail, Phone, Plus, Search, Settings2, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { ErrorState, LoadingState, PermissionDeniedState, StatePanel } from '../../components/States'
import { Button, ButtonLink } from '../../components/ui/Button'
import { ActionMenu as FloatingActionMenu } from '../../components/ui/ActionMenu'
import { CollapsibleFilterPanel } from '../../components/ui/CollapsibleFilterPanel'
import { IconButton } from '../../components/ui/IconButton'
import { useEmployeeBranchOptions, useEmployeePositions, useEmployees, type EmployeeFilters } from './api'
import { EmployeeAccountBadge, EmployeeStatusBadge } from './EmployeeBadges'
import { employeePositionName } from './format'
import type { EmployeeAccountState, EmployeeListItem, EmployeeStatus } from './types'

const statuses: EmployeeStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED']
const accountStatuses: EmployeeAccountState[] = ['NO_ACCOUNT', 'ACCOUNT_ACTIVE', 'ACCOUNT_INACTIVE', 'ACCOUNT_LOCKED']

export function EmployeeListPage() {
  const { t, i18n } = useTranslation()
  const { hasPermission } = useAuth()
  const [params, setParams] = useSearchParams()
  const filters: EmployeeFilters = {
    page: Math.max(0, Number(params.get('page') ?? 0) || 0), size: 20,
    search: params.get('search') ?? '', status: (params.get('status') as EmployeeStatus | null) ?? '',
    positionId: params.get('positionId') ?? '', branchId: params.get('branchId') ?? '',
    accountStatus: (params.get('accountStatus') as EmployeeAccountState | null) ?? '',
    sort: params.get('sort') ?? 'employeeCode,asc',
  }
  const [searchInput, setSearchInput] = useState(filters.search)
  const query = useEmployees(filters)
  const positions = useEmployeePositions()
  const branches = useEmployeeBranchOptions()
  const canCreate = hasPermission(PERMISSION_CODES.EMPLOYEE_CREATE)
  const canUpdate = hasPermission(PERMISSION_CODES.EMPLOYEE_UPDATE)
  const canManagePositions = hasPermission(PERMISSION_CODES.EMPLOYEE_POSITION_MANAGE)
  const forbidden = query.error instanceof ApiError && query.error.status === 403
  const activeFilterCount = [filters.status, filters.positionId, filters.branchId, filters.accountStatus, filters.sort !== 'employeeCode,asc' ? filters.sort : ''].filter(Boolean).length
  const hasFilters = activeFilterCount > 0 || Boolean(filters.search)

  const patchFilters = (updates: Record<string, string>) => setParams((current) => {
    const next = new URLSearchParams(current)
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    next.set('page', '0')
    return next
  })
  const clearFilters = () => { setSearchInput(''); setParams(new URLSearchParams({ sort: 'employeeCode,asc' })) }

  useEffect(() => setSearchInput(filters.search), [filters.search])
  useEffect(() => {
    if (searchInput === filters.search) return
    const timer = window.setTimeout(() => {
      setParams((current) => {
        const next = new URLSearchParams(current)
        if (searchInput) next.set('search', searchInput)
        else next.delete('search')
        next.set('page', '0')
        return next
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [filters.search, searchInput, setParams])

  return <div className="page-container employee-list-page">
    <header className="page-header"><div><p className="eyebrow">{t('employee:employee')}</p><h1>{t('employee:title')}</h1><p>{t('employee:subtitle')}</p></div>{(canCreate || canManagePositions) && <div className="page-header__actions">{canManagePositions && <ButtonLink variant="secondary" to="/employees/positions"><Settings2 size={18} aria-hidden="true" />{t('employee:positionsTitle')}</ButtonLink>}{canCreate && <ButtonLink to="/employees/new" variant="create"><Plus size={18} aria-hidden="true" />{t('employee:add')}</ButtonLink>}</div>}</header>
    <div className="employee-filter-bar">
      <label className="search-box"><Search size={18} aria-hidden="true" /><span className="sr-only">{t('search')}</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('employee:searchPlaceholder')} /></label>
      <CollapsibleFilterPanel label={t('employee:filters')} activeCount={activeFilterCount} fieldsClassName="employee-filter-fields"><EmployeeFiltersControl filters={filters} patch={patchFilters} positions={positions.data ?? []} branches={branches.data ?? []} t={t} language={i18n.language} /></CollapsibleFilterPanel>
    </div>
    {hasFilters && <div className="active-filter-chips"><FilterChip label={t('clear')} onClear={clearFilters} /></div>}
    <div className="list-meta"><strong>{query.data ? t('employee:count', { count: query.data.totalElements }) : t('loading')}</strong>{query.isFetching && query.data && <span className="subtle-progress" role="status">{t('loading')}</span>}</div>
    {forbidden ? <PermissionDeniedState /> : query.isPending ? <LoadingState rows={6} /> : query.isError ? <ErrorState title={t('employee:loadErrorTitle')} body={t('employee:loadErrorBody')} onRetry={() => void query.refetch()} /> : query.data.items.length === 0 ? <StatePanel icon={<UsersRound />} title={hasFilters ? t('employee:filteredEmptyTitle') : t('employee:emptyTitle')} body={hasFilters ? t('employee:filteredEmptyBody') : t('employee:emptyBody')} action={hasFilters ? <Button variant="secondary" onClick={clearFilters}>{t('clear')}</Button> : canCreate ? <ButtonLink to="/employees/new" variant="create"><Plus size={18} aria-hidden="true" />{t('employee:add')}</ButtonLink> : undefined} /> : <>
      <div className="employee-table-wrap employee-desktop-view"><table className="employee-table"><thead><tr><th>{t('employee:employee')}</th><th>{t('employee:position')}</th><th>{t('employee:primaryBranch')}</th><th>{t('employee:hireDate')}</th><th>{t('status')}</th><th>{t('employee:account')}</th><th><span className="sr-only">{t('actions')}</span></th></tr></thead><tbody>{query.data.items.map((employee) => <EmployeeRow key={employee.id} employee={employee} canUpdate={canUpdate} t={t} language={i18n.language} />)}</tbody></table></div>
      <div className="employee-card-list employee-mobile-view">{query.data.items.map((employee) => <EmployeeCard key={employee.id} employee={employee} canUpdate={canUpdate} t={t} language={i18n.language} />)}</div>
      <Pagination page={query.data.page} totalPages={query.data.totalPages} onPage={(page) => setParams((current) => { const next = new URLSearchParams(current); next.set('page', String(page)); return next })} t={t} />
    </>}
  </div>
}

function EmployeeFiltersControl({ filters, patch, positions, branches, t, language }: { filters: EmployeeFilters; patch: (updates: Record<string, string>) => void; positions: ReturnType<typeof useEmployeePositions>['data']; branches: ReturnType<typeof useEmployeeBranchOptions>['data']; t: ReturnType<typeof useTranslation>['t']; language: string }) {
  return <>
    <label><span className="sr-only">{t('status')}</span><select value={filters.status} onChange={(e) => patch({ status: e.target.value })}><option value="">{t('employee:allStatuses')}</option>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status, t)}</option>)}</select></label>
    <label><span className="sr-only">{t('employee:position')}</span><select value={filters.positionId} onChange={(e) => patch({ positionId: e.target.value })}><option value="">{t('employee:allPositions')}</option>{positions?.map((position) => <option key={position.id} value={position.id}>{employeePositionName(position, language)}</option>)}</select></label>
    <label><span className="sr-only">{t('employee:branches')}</span><select value={filters.branchId} onChange={(e) => patch({ branchId: e.target.value })}><option value="">{t('employee:allBranches')}</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
    <label><span className="sr-only">{t('employee:account')}</span><select value={filters.accountStatus} onChange={(e) => patch({ accountStatus: e.target.value })}><option value="">{t('employee:allAccounts')}</option>{accountStatuses.map((status) => <option key={status} value={status}>{accountLabel(status, t)}</option>)}</select></label>
    <label><span className="sr-only">{t('employee:newest')}</span><select value={filters.sort} onChange={(e) => patch({ sort: e.target.value })}><option value="employeeCode,asc">{t('employee:codeAsc')}</option><option value="updatedAt,desc">{t('employee:newest')}</option><option value="fullName,asc">{t('employee:nameAsc')}</option><option value="hireDate,desc">{t('employee:hireNewest')}</option></select></label>
  </>
}

function EmployeeRow({ employee, canUpdate, t, language }: { employee: EmployeeListItem; canUpdate: boolean; t: ReturnType<typeof useTranslation>['t']; language: string }) {
  return <tr><td><Link className="employee-identity" to={`/employees/${employee.id}`}><span className="avatar">{initials(employee.fullName)}</span><span><strong>{employee.fullName}</strong><small>{employee.employeeCode}{employee.phone ? ` · ${employee.phone}` : ''}</small></span></Link></td><td>{employeePositionName(employee.position, language)}</td><td>{employee.primaryBranch?.name ?? t('notAvailable')}{employee.activeBranchCount > 1 && <small className="employee-count-more">+{employee.activeBranchCount - 1}</small>}</td><td>{formatDate(employee.hireDate, language)}</td><td><EmployeeStatusBadge status={employee.status} t={t} /></td><td><EmployeeAccountBadge status={employee.account?.status ?? 'NO_ACCOUNT'} t={t} /></td><td><ActionMenu employee={employee} canUpdate={canUpdate} t={t} /></td></tr>
}

function EmployeeCard({ employee, canUpdate, t, language }: { employee: EmployeeListItem; canUpdate: boolean; t: ReturnType<typeof useTranslation>['t']; language: string }) {
  return <article className="employee-card"><Link to={`/employees/${employee.id}`} className="employee-card__main"><div className="employee-card__top"><span className="avatar avatar--large">{initials(employee.fullName)}</span><span className="employee-card__identity"><strong>{employee.fullName}</strong><small>{employee.employeeCode}</small></span><EmployeeStatusBadge status={employee.status} t={t} /></div><div className="employee-card__facts"><span><BriefcaseBusiness size={16} />{employeePositionName(employee.position, language)}</span><span><Building2 size={16} />{employee.primaryBranch?.name ?? t('notAvailable')}{employee.activeBranchCount > 1 ? ` +${employee.activeBranchCount - 1}` : ''}</span>{employee.phone && <span><Phone size={16} />{employee.phone}</span>}{employee.email && <span><Mail size={16} />{employee.email}</span>}</div><div className="employee-card__footer"><EmployeeAccountBadge status={employee.account?.status ?? 'NO_ACCOUNT'} t={t} /><small>{t('employee:startedOn', { date: formatDate(employee.hireDate, language) })}</small></div></Link><ActionMenu employee={employee} canUpdate={canUpdate} t={t} /></article>
}

function ActionMenu({ employee, canUpdate, t }: { employee: EmployeeListItem; canUpdate: boolean; t: ReturnType<typeof useTranslation>['t'] }) {
  return <FloatingActionMenu label={t('openMenu')}><Link role="menuitem" to={`/employees/${employee.id}`}><UserCircleIcon size={27} weight="fill" aria-hidden="true" /><span className="action-menu__label">{t('employee:profile')}</span></Link>{canUpdate && <Link role="menuitem" to={`/employees/${employee.id}/edit`}><PencilSimpleIcon size={26} weight="fill" aria-hidden="true" /><span className="action-menu__label">{t('employee:editProfile')}</span></Link>}</FloatingActionMenu>
}

function Pagination({ page, totalPages, onPage, t }: { page: number; totalPages: number; onPage: (page: number) => void; t: ReturnType<typeof useTranslation>['t'] }) {
  if (totalPages <= 1) return null
  return <nav className="pagination" aria-label={t('page', { current: page + 1, total: totalPages })}><IconButton variant="secondary" onClick={() => onPage(page - 1)} disabled={page === 0} label={t('previous')}><ChevronLeft size={18} /></IconButton><span>{t('page', { current: page + 1, total: totalPages })}</span><IconButton variant="secondary" onClick={() => onPage(page + 1)} disabled={page + 1 >= totalPages} label={t('next')}><ChevronRight size={18} /></IconButton></nav>
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) { return <button type="button" className="filter-chip" onClick={onClear}>{label}<span aria-hidden="true">×</span></button> }
function initials(name: string) { return name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase() }
function formatDate(value: string, language: string) { return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-GB' : 'vi-VN').format(new Date(`${value}T00:00:00`)) }
function statusLabel(status: EmployeeStatus, t: ReturnType<typeof useTranslation>['t']) { return t(`employee:${status.toLowerCase()}`) }
function accountLabel(status: EmployeeAccountState, t: ReturnType<typeof useTranslation>['t']) { return t(`employee:${({ NO_ACCOUNT: 'noAccount', ACCOUNT_ACTIVE: 'accountActive', ACCOUNT_INACTIVE: 'accountInactive', ACCOUNT_LOCKED: 'accountLocked' } as const)[status]}`) }
