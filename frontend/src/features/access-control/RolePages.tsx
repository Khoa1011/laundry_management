import {
  Activity, ArrowLeft, ChevronRight, CircleCheck, ClipboardClock, Copy, Ellipsis,
  KeyRound, Layers3, Plus, Search, ShieldAlert, ShieldCheck, UserRoundCog, UsersRound,
} from 'lucide-react'
import {
  useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  Link, useBeforeUnload, useBlocker, useNavigate, useParams, useSearchParams,
} from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { ConfirmDialog, OverlayDialog } from '../../components/OverlayDialog'
import { ErrorState, LoadingState, PermissionDeniedState, StatePanel } from '../../components/States'
import { StatCard } from '../../components/ui/StatCard'
import { useToast } from '../../providers/ToastProvider'
import {
  useAccessMutations, useRole, useRoleAudit, useRoleMatrix, useRoles, useRoleUsers,
} from './api'
import type {
  AccessAudit, AccessStatus, AccessUser, PermissionModule, Role,
} from './types'

type RoleTab = 'overview' | 'permissions' | 'users' | 'history'

function localizedRoleName(role: Role, language: string) {
  if (!role.system) return role.displayName
  return language.startsWith('en') ? role.nameEn || role.displayName : role.nameVi || role.displayName
}

function localizedRoleDescription(role: Role, language: string) {
  if (!role.system) return role.description
  return language.startsWith('en')
    ? role.descriptionEn || role.description
    : role.descriptionVi || role.description
}

function dateTime(value: string, language: string) {
  return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-US' : 'vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function PageHeader({ title, subtitle, back, actions }: {
  title: string
  subtitle?: string
  back: string
  actions?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <header className="page-header access-header role-page-header">
      <div className="access-heading-row">
        <Link className="icon-button" to={back} aria-label={t('back')}><ArrowLeft size={20} aria-hidden="true" /></Link>
        <div>
          <p className="eyebrow">{t('access:administration')}</p>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-header__actions role-header-actions">{actions}</div>}
    </header>
  )
}

function RoleBreadcrumb({ current }: { current: string }) {
  const { t } = useTranslation()
  return <nav className="role-breadcrumb" aria-label={t('access:breadcrumb')}><Link to="/settings/access">{t('access:accessControl')}</Link><ChevronRight size={14} aria-hidden="true" /><Link to="/settings/access/roles">{t('access:roles')}</Link><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">{current}</span></nav>
}

function StatusBadge({ status }: { status: AccessStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`badge badge--status-${status.toLowerCase()}`}>
      <span className="badge__dot" aria-hidden="true" />
      {t(status === 'ACTIVE' ? 'access:active' : 'access:inactive')}
    </span>
  )
}

function TypeBadge({ system }: { system: boolean }) {
  const { t } = useTranslation()
  return <span className={`badge role-type-badge role-type-badge--${system ? 'system' : 'custom'}`}>{t(system ? 'access:systemRole' : 'access:customRole')}</span>
}

function Field({ label, children, error, hint, required = false }: {
  label: string
  children: ReactNode
  error?: string
  hint?: string
  required?: boolean
}) {
  return (
    <label className={`form-field${error ? ' form-field--error' : ''}`}>
      <span className="form-field__label">{label}{required && <span aria-hidden="true"> *</span>}</span>
      {children}
      {hint && !error && <small className="form-field__hint">{hint}</small>}
      {error && <small className="form-field__error" role="alert">{error}</small>}
    </label>
  )
}

function RoleQueryFailure({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useTranslation()
  if (error instanceof ApiError && error.status === 403) return <PermissionDeniedState />
  if (error instanceof ApiError && error.status === 404) {
    return <StatePanel title={t('access:roleNotFound')} body={t('access:roleNotFoundBody')} icon={<ShieldCheck />} />
  }
  return <ErrorState title={t('errors:genericTitle')} body={t('access:genericError')} onRetry={retry} />
}

export function RoleListPage() {
  const { t, i18n } = useTranslation()
  const { hasPermission } = useAuth()
  const [search, setSearch] = useState('')
  const canRead = hasPermission(PERMISSION_CODES.ACCESS_ROLE_READ)
  const query = useRoles(search, 50, canRead)
  if (!canRead) return <div className="page-container"><PermissionDeniedState /></div>

  return (
    <div className="page-container access-page role-page-enter">
      <PageHeader
        title={t('access:roles')}
        subtitle={t('access:rolesSubtitle')}
        back="/settings/access"
        actions={hasPermission(PERMISSION_CODES.ACCESS_ROLE_CREATE)
          ? <Link to="/settings/access/roles/new" className="button button--create"><Plus size={18} aria-hidden="true" />{t('access:createRole')}</Link>
          : undefined}
      />
      <label className="search-input access-search">
        <Search size={19} aria-hidden="true" />
        <span className="sr-only">{t('access:searchRoles')}</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('access:searchRoles')} />
      </label>
      {query.isPending ? <LoadingState rows={5} /> : query.isError
        ? <RoleQueryFailure error={query.error} retry={() => void query.refetch()} />
        : query.data.items.length === 0
          ? <StatePanel icon={<ShieldCheck />} title={t('access:noRoles')} body={t('access:noRolesBody')} />
          : (
            <>
              <div className="role-card-list mobile-data-view">
                {query.data.items.map((role) => (
                  <Link className="role-list-card" to={`/settings/access/roles/${role.id}`} key={role.id}>
                    <span className="role-list-card__heading">
                      <span><strong>{localizedRoleName(role, i18n.language)}</strong><small>{role.code}</small></span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </span>
                    <span className="role-list-card__badges"><TypeBadge system={role.system} /><StatusBadge status={role.status} /></span>
                    <span className="role-list-card__stats">
                      <span><strong>{role.permissionCount}</strong><small>{t('access:permissions')}</small></span>
                      <span><strong>{role.assignedUsers}</strong><small>{t('access:assignedUsers')}</small></span>
                    </span>
                  </Link>
                ))}
              </div>
              <div className="access-table-wrap role-list-table-wrap desktop-data-view">
                <table className="access-table role-list-table">
                  <thead><tr><th>{t('access:roleListName')}</th><th>{t('access:roleType')}</th><th>{t('access:permissions')}</th><th>{t('access:assignedUsers')}</th><th>{t('access:status')}</th><th><span className="sr-only">{t('access:actions')}</span></th></tr></thead>
                  <tbody>{query.data.items.map((role) => <tr key={role.id}>
                    <td><strong>{localizedRoleName(role, i18n.language)}</strong><small>{role.code}</small></td>
                    <td><TypeBadge system={role.system} /></td>
                    <td>{role.permissionCount}</td>
                    <td>{role.assignedUsers}</td>
                    <td><StatusBadge status={role.status} /></td>
                    <td><Link className="text-button" to={`/settings/access/roles/${role.id}`}>{t('access:viewDetails')}<ChevronRight size={16} aria-hidden="true" /></Link></td>
                  </tr>)}</tbody>
                </table>
              </div>
            </>
          )}
    </div>
  )
}

interface RoleFormState {
  displayName: string
  description: string
  status: AccessStatus
  copyPermissionsFromRoleId: string
}

const emptyRoleForm: RoleFormState = {
  displayName: '',
  description: '',
  status: 'ACTIVE',
  copyPermissionsFromRoleId: '',
}

function validateRoleForm(form: RoleFormState, t: ReturnType<typeof useTranslation>['t']) {
  const errors: Partial<Record<'displayName' | 'description', string>> = {}
  if (!form.displayName.trim()) errors.displayName = t('access:nameRequired')
  else if (form.displayName.trim().length > 150) errors.displayName = t('access:nameTooLong')
  if (form.description.trim().length > 1000) errors.description = t('access:descriptionTooLong')
  return errors
}

export function RoleFormPage() {
  const { t, i18n } = useTranslation()
  const { roleId } = useParams()
  const id = roleId ? Number(roleId) : null
  const editing = id !== null
  const { hasPermission } = useAuth()
  const canUse = hasPermission(editing ? PERMISSION_CODES.ACCESS_ROLE_UPDATE : PERMISSION_CODES.ACCESS_ROLE_CREATE)
  const canReadRoles = hasPermission(PERMISSION_CODES.ACCESS_ROLE_READ)
  const canChangeStatus = hasPermission(PERMISSION_CODES.ACCESS_ROLE_DEACTIVATE)
  const query = useRole(id, editing && canUse)
  const sourceRoles = useRoles('', 100, !editing && canReadRoles)
  const mutations = useAccessMutations()
  const navigate = useNavigate()
  const { notify } = useToast()
  const [form, setForm] = useState<RoleFormState>(emptyRoleForm)
  const [initial, setInitial] = useState<RoleFormState>(emptyRoleForm)
  const [errors, setErrors] = useState<Partial<Record<'displayName' | 'description', string>>>({})
  const [conflictOpen, setConflictOpen] = useState(false)
  const allowLeave = useRef(false)

  useEffect(() => {
    if (!query.data) return
    const values = {
      displayName: localizedRoleName(query.data, i18n.language),
      description: localizedRoleDescription(query.data, i18n.language) ?? '',
      status: query.data.status,
      copyPermissionsFromRoleId: '',
    }
    setForm(values)
    setInitial(values)
  }, [query.data, i18n.language])

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial)
  const blocker = useBlocker(() => isDirty && !allowLeave.current)
  useBeforeUnload((event) => { if (isDirty && !allowLeave.current) event.preventDefault() })
  const selectedSource = sourceRoles.data?.items.find((role) => String(role.id) === form.copyPermissionsFromRoleId)
  const pending = mutations.createRole.isPending || mutations.updateRole.isPending

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = validateRoleForm(form, t)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      notify(t('validation:fixErrors'), 'error')
      return
    }
    if (editing && query.data?.system) return
    try {
      const saved = editing
        ? await mutations.updateRole.mutateAsync({
          roleId: id,
          body: {
            displayName: form.displayName.trim(),
            description: form.description.trim() || null,
            status: form.status,
            version: query.data?.version,
          },
        })
        : await mutations.createRole.mutateAsync({
          displayName: form.displayName.trim(),
          description: form.description.trim() || null,
          copyPermissionsFromRoleId: form.copyPermissionsFromRoleId ? Number(form.copyPermissionsFromRoleId) : null,
        })
      allowLeave.current = true
      setInitial(form)
      notify(t(editing ? 'access:updateSuccess' : 'access:createSuccess'))
      navigate(editing ? `/settings/access/roles/${saved.id}` : `/settings/access/roles/${saved.id}/permissions`, { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.problem.errorCode === 'ROLE_VERSION_CONFLICT') setConflictOpen(true)
      else notify(t('access:genericError'), 'error')
    }
  }

  if (!canUse) return <div className="page-container"><PermissionDeniedState /></div>
  if (editing && query.isPending) return <div className="page-container"><LoadingState /></div>
  if (editing && query.isError) return <div className="page-container"><RoleQueryFailure error={query.error} retry={() => void query.refetch()} /></div>
  const role = query.data
  const systemRole = Boolean(role?.system)

  return (
    <div className="page-container form-page access-page role-form-page role-page-enter">
      <RoleBreadcrumb current={t(editing ? 'access:editRole' : 'access:createRole')} />
      <PageHeader
        title={t(editing ? 'access:editRole' : 'access:createRole')}
        subtitle={editing ? localizedRoleName(role as Role, i18n.language) : t('access:rolesSubtitle')}
        back={editing ? `/settings/access/roles/${id}` : '/settings/access/roles'}
      />
      <form id="role-form" className="role-business-form" onSubmit={(event) => void submit(event)} noValidate>
        {systemRole && <div className="inline-alert inline-alert--info" role="status"><ShieldCheck size={20} aria-hidden="true" /><span><strong>{t('access:systemNoticeTitle')}</strong>{t('access:systemNoticeBody')}</span></div>}
        <section className="form-section role-form-card">
          <div className="section-heading"><span className="section-icon"><UserRoundCog size={20} aria-hidden="true" /></span><div><h2>{t('access:roleInformation')}</h2><p>{t('access:customDataLanguageNote')}</p></div></div>
          <div className="form-stack">
            <Field label={t('access:roleName')} error={errors.displayName} required>
              <input
                value={form.displayName}
                disabled={systemRole}
                maxLength={150}
                autoFocus={!editing}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                placeholder={t('access:roleNamePlaceholder')}
              />
            </Field>
            <Field label={t('access:description')} error={errors.description}>
              <textarea
                value={form.description}
                disabled={systemRole}
                maxLength={1000}
                rows={5}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder={t('access:descriptionPlaceholder')}
              />
            </Field>
            {!editing && canReadRoles && <Field label={t('access:copyPermissionsFrom')}>
              <select disabled={sourceRoles.isPending} value={form.copyPermissionsFromRoleId} onChange={(event) => setForm({ ...form, copyPermissionsFromRoleId: event.target.value })}>
                <option value="">{sourceRoles.isPending ? t('loading') : t('access:startWithoutPermissions')}</option>
                {sourceRoles.data?.items.filter((item) => item.status === 'ACTIVE').map((item) =>
                  <option key={item.id} value={item.id}>{localizedRoleName(item, i18n.language)} · {item.code} · {t('access:permissionCount', { count: item.permissionCount })}</option>)}
              </select>
            </Field>}
            {!editing && sourceRoles.isError && <div className="inline-alert inline-alert--warning" role="alert">{t('access:genericError')}</div>}
            {!editing && selectedSource && <div className="role-copy-preview" role="status"><Copy size={18} aria-hidden="true" /><span>{t('access:copyPreview', { count: selectedSource.permissionCount, name: localizedRoleName(selectedSource, i18n.language) })}</span></div>}
            {!editing && <div className="inline-alert inline-alert--neutral"><KeyRound size={18} aria-hidden="true" />{t('access:generatedCodeNote')}</div>}
            {editing && !systemRole && canChangeStatus && <Field label={t('access:status')}>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AccessStatus })}>
                <option value="ACTIVE">{t('access:active')}</option>
                <option value="INACTIVE">{t('access:inactive')}</option>
              </select>
            </Field>}
          </div>
        </section>
        {editing && role && <SystemInformation role={role} language={i18n.language} />}
      </form>
      <div className="sticky-action-bar role-form-actions">
        {isDirty && <span className="unsaved-indicator" role="status">{t('access:unsaved')}</span>}
        {editing && hasPermission(PERMISSION_CODES.ACCESS_ROLE_PERMISSION_ASSIGN) && <Link className="button button--secondary role-matrix-secondary" to={`/settings/access/roles/${id}/permissions`}><KeyRound size={18} aria-hidden="true" />{t('access:openMatrix')}</Link>}
        <button type="button" className="button button--secondary" onClick={() => navigate(editing ? `/settings/access/roles/${id}` : '/settings/access/roles')} disabled={pending}>{t('cancel')}</button>
        {!systemRole && <button type="submit" form="role-form" className={`button ${editing ? 'button--primary' : 'button--create'}`} disabled={pending}>{!pending && !editing && <Plus size={18} aria-hidden="true" />}{pending ? t('saving') : t(editing ? 'access:saveChanges' : 'access:createAndConfigure')}</button>}
      </div>
      <ConfirmDialog open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()} onConfirm={() => blocker.proceed?.()} title={t('unsavedTitle')} body={t('unsavedBody')} confirmLabel={t('leave')} tone="danger" />
      <ConfirmDialog open={conflictOpen} onClose={() => setConflictOpen(false)} onConfirm={() => { setConflictOpen(false); void query.refetch() }} title={t('access:conflict')} body={t('access:conflict')} confirmLabel={t('reload')} />
    </div>
  )
}

function SystemInformation({ role, language }: { role: Role; language: string }) {
  const { t } = useTranslation()
  return (
    <details className="form-section system-information">
      <summary>{t('access:systemInformation')}</summary>
      <dl className="role-definition-list">
        <div><dt>{t('access:systemCode')}</dt><dd><code>{role.code}</code><small>{t('access:systemCodeHelp')}</small></dd></div>
        <div><dt>{t('access:roleType')}</dt><dd>{t(role.system ? 'access:systemRole' : 'access:customRole')}</dd></div>
        <div><dt>{t('access:createdAt')}</dt><dd>{dateTime(role.createdAt, language)}</dd></div>
        <div><dt>{t('access:createdBy')}</dt><dd>{role.createdBy?.displayName ?? t('notAvailable')}</dd></div>
        <div><dt>{t('access:updatedAt')}</dt><dd>{dateTime(role.updatedAt, language)}</dd></div>
        <div><dt>{t('access:updatedBy')}</dt><dd>{role.updatedBy?.displayName ?? t('notAvailable')}</dd></div>
        <div><dt>{t('access:version')}</dt><dd>{role.version}</dd></div>
      </dl>
    </details>
  )
}

export function RoleDetailPage() {
  const { t, i18n } = useTranslation()
  const { roleId } = useParams()
  const id = Number(roleId)
  const { hasPermission } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab') as RoleTab | null
  const canReadUsers = hasPermission(PERMISSION_CODES.ACCESS_USER_READ)
  const canReadAudit = hasPermission(PERMISSION_CODES.ACCESS_AUDIT_READ)
  const availableTabs = useMemo<RoleTab[]>(() => [
    'overview',
    'permissions',
    ...(canReadUsers ? ['users' as const] : []),
    ...(canReadAudit ? ['history' as const] : []),
  ], [canReadAudit, canReadUsers])
  const activeTab = requestedTab && availableTabs.includes(requestedTab) ? requestedTab : 'overview'
  const matrixQuery = useRoleMatrix(id)
  const [userPage, setUserPage] = useState(0)
  const [auditPage, setAuditPage] = useState(0)
  const usersQuery = useRoleUsers(id, userPage, canReadUsers && activeTab === 'users')
  const auditQuery = useRoleAudit(id, auditPage, canReadAudit && activeTab === 'history')
  const mutations = useAccessMutations()
  const { notify } = useToast()
  const navigate = useNavigate()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [cloneOpen, setCloneOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [statusReason, setStatusReason] = useState('')

  if (matrixQuery.isPending) return <div className="page-container"><LoadingState rows={6} /></div>
  if (matrixQuery.isError) return <div className="page-container"><RoleQueryFailure error={matrixQuery.error} retry={() => void matrixQuery.refetch()} /></div>

  const matrix = matrixQuery.data
  const role = matrix.role
  const roleName = localizedRoleName(role, i18n.language)
  const roleDescription = localizedRoleDescription(role, i18n.language)
  const setTab = (tab: RoleTab) => setSearchParams(tab === 'overview' ? {} : { tab })
  const handleTabKeys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % availableTabs.length
    if (event.key === 'ArrowLeft') next = (index - 1 + availableTabs.length) % availableTabs.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = availableTabs.length - 1
    setTab(availableTabs[next])
    requestAnimationFrame(() => tabRefs.current[next]?.focus())
  }
  const changeStatus = async () => {
    if (!statusReason.trim()) return
    try {
      await mutations.changeRoleStatus.mutateAsync({
        roleId: id,
        body: {
          status: role.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
          version: role.version,
          reason: statusReason.trim(),
        },
      })
      setStatusOpen(false)
      setStatusReason('')
      notify(t('access:statusSuccess'))
    } catch {
      notify(t('access:genericError'), 'error')
    }
  }

  return (
    <div className="page-container access-page role-detail-page role-page-enter">
      <RoleBreadcrumb current={roleName} />
      <PageHeader
        title={roleName}
        subtitle={roleDescription || t('access:noDescription')}
        back="/settings/access/roles"
        actions={<>
          {hasPermission(PERMISSION_CODES.ACCESS_ROLE_UPDATE) && <Link className="button button--secondary role-edit-action" to={`/settings/access/roles/${id}/edit`}>{t('edit')}</Link>}
          {hasPermission(PERMISSION_CODES.ACCESS_ROLE_PERMISSION_ASSIGN) && <Link className="button button--primary" to={`/settings/access/roles/${id}/permissions`}><KeyRound size={18} aria-hidden="true" />{t('access:openMatrix')}</Link>}
          <details className="action-menu role-more-menu">
            <summary className="icon-button" aria-label={t('access:moreActions')}><Ellipsis size={21} aria-hidden="true" /></summary>
            <div className="action-menu__content">
              {hasPermission(PERMISSION_CODES.ACCESS_ROLE_UPDATE) && <Link className="role-menu-edit" to={`/settings/access/roles/${id}/edit`}>{t('edit')}</Link>}
              {hasPermission(PERMISSION_CODES.ACCESS_ROLE_CLONE) && <button type="button" onClick={() => setCloneOpen(true)}><Copy size={17} aria-hidden="true" />{t('access:cloneRole')}</button>}
              {!role.system && hasPermission(PERMISSION_CODES.ACCESS_ROLE_DEACTIVATE) && <button type="button" onClick={() => setStatusOpen(true)}><Activity size={17} aria-hidden="true" />{t(role.status === 'ACTIVE' ? 'access:deactivate' : 'access:reactivate')}</button>}
              {canReadAudit && <button type="button" onClick={() => setTab('history')}><ClipboardClock size={17} aria-hidden="true" />{t('access:viewHistory')}</button>}
            </div>
          </details>
        </>}
      />
      <div className="role-identity-line"><code>{role.code}</code><StatusBadge status={role.status} /><TypeBadge system={role.system} /></div>
      <section className="stat-card-grid role-summary-grid" aria-label={t('access:roleDetails')}>
        <StatCard tone={role.status === 'ACTIVE' ? 'success' : 'neutral'} icon={<CircleCheck />} label={t('access:status')} value={t(role.status === 'ACTIVE' ? 'access:active' : 'access:inactive')} />
        <StatCard tone="primary" icon={<KeyRound />} label={t('access:permissions')} value={t('access:permissionCount', { count: role.permissionCount })} />
        <StatCard tone="operational" icon={<UsersRound />} label={t('access:assignedUsers')} value={t('access:userCount', { count: role.assignedUsers })} />
        <StatCard tone="neutral" icon={<Layers3 />} label={t('access:roleType')} value={t(role.system ? 'access:systemRole' : 'access:customRole')} />
      </section>
      <div className="role-tabs" role="tablist" aria-label={t('access:roleDetails')}>
        {availableTabs.map((tab, index) => <button
          key={tab}
          ref={(node) => { tabRefs.current[index] = node }}
          type="button"
          role="tab"
          id={`role-tab-${tab}`}
          aria-selected={activeTab === tab}
          aria-controls={`role-panel-${tab}`}
          tabIndex={activeTab === tab ? 0 : -1}
          className={activeTab === tab ? 'role-tab role-tab--active' : 'role-tab'}
          onClick={() => setTab(tab)}
          onKeyDown={(event) => handleTabKeys(event, index)}
        >{t(`access:${tab === 'permissions' ? 'permissionSummary' : tab === 'users' ? 'usersTab' : tab}`)}{tab === 'permissions' && <span>{role.permissionCount}</span>}{tab === 'users' && <span>{role.assignedUsers}</span>}</button>)}
      </div>
      <section role="tabpanel" id={`role-panel-${activeTab}`} aria-labelledby={`role-tab-${activeTab}`} className="role-tab-panel">
        {activeTab === 'overview' && <RoleOverview role={role} description={roleDescription} language={i18n.language} />}
        {activeTab === 'permissions' && <RolePermissionSummary role={role} modules={matrix.modules} selected={new Set(matrix.permissionCodes)} highRisk={matrix.highRiskPermissionCount} language={i18n.language} canEdit={hasPermission(PERMISSION_CODES.ACCESS_ROLE_PERMISSION_ASSIGN)} />}
        {activeTab === 'users' && <RoleUsersPanel query={usersQuery} page={userPage} onPage={setUserPage} />}
        {activeTab === 'history' && <RoleHistoryPanel query={auditQuery} page={auditPage} onPage={setAuditPage} />}
      </section>
      <CloneRoleDrawer open={cloneOpen} onClose={() => setCloneOpen(false)} role={role} roleName={roleName} onSuccess={(saved) => navigate(`/settings/access/roles/${saved.id}`)} />
      <OverlayDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title={t('access:changeStatus')}
        footer={<>
          <button type="button" className="button button--secondary" onClick={() => setStatusOpen(false)} disabled={mutations.changeRoleStatus.isPending}>{t('cancel')}</button>
          <button type="button" className={`button ${role.status === 'ACTIVE' ? 'button--danger' : 'button--primary'}`} onClick={() => void changeStatus()} disabled={!statusReason.trim() || mutations.changeRoleStatus.isPending}>{mutations.changeRoleStatus.isPending ? t('saving') : t(role.status === 'ACTIVE' ? 'access:deactivate' : 'access:reactivate')}</button>
        </>}
      >
        <Field label={t('access:statusReason')} required>
          <textarea value={statusReason} rows={4} maxLength={500} onChange={(event) => setStatusReason(event.target.value)} placeholder={t('access:statusReasonPlaceholder')} />
        </Field>
      </OverlayDialog>
    </div>
  )
}

function RoleOverview({ role, description, language }: { role: Role; description?: string | null; language: string }) {
  const { t } = useTranslation()
  return (
    <div className="role-overview-grid">
      <section className="content-card role-information-card">
        <div className="section-heading"><span className="section-icon"><ShieldCheck size={20} aria-hidden="true" /></span><div><h2>{t('access:roleInformation')}</h2><p>{description || t('access:noDescription')}</p></div></div>
        <dl className="role-definition-list">
          <div><dt>{t('access:systemCode')}</dt><dd><code>{role.code}</code></dd></div>
          <div><dt>{t('access:roleName')}</dt><dd>{localizedRoleName(role, language)}</dd></div>
          <div><dt>{t('access:description')}</dt><dd>{description || t('access:noDescription')}</dd></div>
          <div><dt>{t('access:roleType')}</dt><dd>{t(role.system ? 'access:systemRole' : 'access:customRole')}</dd></div>
          <div><dt>{t('access:status')}</dt><dd><StatusBadge status={role.status} /></dd></div>
          <div><dt>{t('access:createdAt')}</dt><dd>{dateTime(role.createdAt, language)}</dd></div>
          <div><dt>{t('access:updatedAt')}</dt><dd>{dateTime(role.updatedAt, language)}</dd></div>
        </dl>
        {role.system && <div className="inline-alert inline-alert--info"><ShieldCheck size={18} aria-hidden="true" />{t('access:systemRoleInfo')}</div>}
      </section>
      <section className="content-card role-scope-card">
        <div className="section-heading"><span className="section-icon"><Layers3 size={20} aria-hidden="true" /></span><div><h2>{t('access:accessScope')}</h2><p>{t('access:effectiveAccessNote')}</p></div></div>
        <dl className="role-definition-list">
          <div><dt>{t('access:branchScope')}</dt><dd>{t('access:branchScopeValue')}</dd></div>
          <div><dt>{t('access:permissions')}</dt><dd>{t('access:permissionCount', { count: role.permissionCount })}</dd></div>
          <div><dt>{t('access:assignedUsers')}</dt><dd>{t('access:userCount', { count: role.assignedUsers })}</dd></div>
        </dl>
      </section>
    </div>
  )
}

function RolePermissionSummary({ role, modules, selected, highRisk, language, canEdit }: {
  role: Role
  modules: PermissionModule[]
  selected: Set<string>
  highRisk: number
  language: string
  canEdit: boolean
}) {
  const { t } = useTranslation()
  const selectedModules = modules.map((module) => ({
    ...module,
    selectedCount: module.permissions.filter((permission) => selected.has(permission.code)).length,
  })).filter((module) => module.selectedCount > 0)
  return (
    <section className="content-card role-permission-panel">
      <div className="section-header">
        <div><h2>{t('access:permissionSummary')}</h2><p>{t('access:matrixUpdated')} {dateTime(role.updatedAt, language)} · {t('access:updatedBy')}: {role.updatedBy?.displayName ?? t('notAvailable')}</p></div>
        {canEdit && <Link className="button button--primary" to={`/settings/access/roles/${role.id}/permissions`}><KeyRound size={18} aria-hidden="true" />{t('access:editMatrix')}</Link>}
      </div>
      <div className="stat-card-grid stat-card-grid--two permission-summary-totals">
        <StatCard tone="primary" icon={<KeyRound />} label={t('access:selectedPermissions')} value={selected.size} />
        <StatCard tone={highRisk > 0 ? 'danger' : 'neutral'} icon={<ShieldAlert />} label={t('access:highRisk')} value={highRisk} />
      </div>
      {selectedModules.length === 0
        ? <StatePanel compact icon={<KeyRound />} title={t('access:noPermissions')} body={t('access:effectiveAccessNote')} />
        : <div className="permission-summary-list">{selectedModules.map((module) => {
          const name = language.startsWith('en') ? module.nameEn : module.nameVi
          const percentage = Math.round(module.selectedCount / module.permissions.length * 100)
          return <div className="permission-summary-row" key={module.module}>
            <div><strong>{name}</strong><small>{t('access:moduleCoverage', { selected: module.selectedCount, total: module.permissions.length })}</small></div>
            <span className="permission-summary-track" aria-hidden="true"><span style={{ width: `${percentage}%` }} /></span>
          </div>
        })}</div>}
    </section>
  )
}

function RoleUsersPanel({ query, page, onPage }: {
  query: ReturnType<typeof useRoleUsers>
  page: number
  onPage: (page: number) => void
}) {
  const { t } = useTranslation()
  if (query.isPending) return <LoadingState rows={4} />
  if (query.isError) return <RoleQueryFailure error={query.error} retry={() => void query.refetch()} />
  if (query.data.items.length === 0) return <StatePanel icon={<UsersRound />} title={t('access:noUsers')} body={t('access:effectiveAccessNote')} />
  return <>
    <div className="role-user-cards mobile-data-view">{query.data.items.map((user) => <RoleUserCard key={user.id} user={user} />)}</div>
    <div className="access-table-wrap desktop-data-view"><table className="access-table role-users-table"><thead><tr><th>{t('access:assignedUsers')}</th><th>{t('access:username')}</th><th>{t('access:branches')}</th><th>{t('access:overrides')}</th><th>{t('access:status')}</th><th><span className="sr-only">{t('access:actions')}</span></th></tr></thead><tbody>{query.data.items.map((user) => <tr key={user.id}><td><strong>{user.displayName}</strong></td><td>@{user.username}</td><td>{user.branches.map((branch) => branch.name).join(', ')}</td><td>{user.overrideCount}</td><td><StatusBadge status={user.status} /></td><td><Link className="text-button" to={`/settings/access/users/${user.id}`}>{t('access:openAccess')}<ChevronRight size={16} /></Link></td></tr>)}</tbody></table></div>
    <Pagination page={page} totalPages={query.data.totalPages} onPage={onPage} />
  </>
}

function RoleUserCard({ user }: { user: AccessUser }) {
  const { t } = useTranslation()
  return <article className="role-user-card"><div className="role-user-heading"><span className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>@{user.username}</small></span><StatusBadge status={user.status} /></div><dl><div><dt>{t('access:branches')}</dt><dd>{user.branches.map((branch) => branch.name).join(', ')}</dd></div><div><dt>{t('access:overrides')}</dt><dd>{user.overrideCount}</dd></div></dl><Link className="button button--secondary button--wide" to={`/settings/access/users/${user.id}`}>{t('access:openAccess')}</Link></article>
}

function RoleHistoryPanel({ query, page, onPage }: {
  query: ReturnType<typeof useRoleAudit>
  page: number
  onPage: (page: number) => void
}) {
  const { t, i18n } = useTranslation()
  if (query.isPending) return <LoadingState rows={4} />
  if (query.isError) return <RoleQueryFailure error={query.error} retry={() => void query.refetch()} />
  if (query.data.items.length === 0) return <StatePanel icon={<ClipboardClock />} title={t('access:noHistory')} body={t('access:rolesSubtitle')} />
  return <>
    <div className="role-history-timeline">{query.data.items.map((item) => <RoleHistoryItem key={item.id} item={item} language={i18n.language} />)}</div>
    <Pagination page={page} totalPages={query.data.totalPages} onPage={onPage} />
  </>
}

function RoleHistoryItem({ item, language }: { item: AccessAudit; language: string }) {
  const { t } = useTranslation()
  const actionKeys: Record<string, string> = {
    ROLE_CREATED: 'access:auditRoleCreated',
    ROLE_UPDATED: 'access:auditRoleUpdated',
    ROLE_STATUS_CHANGED: 'access:auditRoleStatusChanged',
    ROLE_PERMISSIONS_CHANGED: 'access:auditRolePermissionsChanged',
    ROLE_CLONED: 'access:auditRoleCloned',
  }
  return <article className="role-history-item"><span className="role-history-dot" aria-hidden="true" /><div><div className="role-history-heading"><strong>{t(actionKeys[item.action] ?? 'access:changedValues')}</strong><time>{dateTime(item.createdAt, language)}</time></div><p>{t('access:actor')}: {item.actorDisplayName}</p>{item.reason && <p>{t('access:reason')}: {item.reason}</p>}{(item.oldValue || item.newValue) && <details><summary>{t('access:changedValues')}</summary><pre>{item.oldValue || '—'}{'\n→\n'}{item.newValue || '—'}</pre></details>}</div></article>
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null
  return <div className="role-pagination"><button type="button" className="button button--secondary" disabled={page === 0} onClick={() => onPage(page - 1)}>{t('access:previousPage')}</button><span>{t('access:pageCount', { current: page + 1, total: totalPages })}</span><button type="button" className="button button--secondary" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)}>{t('access:nextPage')}</button></div>
}

function CloneRoleDrawer({ open, onClose, role, roleName, onSuccess }: {
  open: boolean
  onClose: () => void
  role: Role
  roleName: string
  onSuccess: (role: Role) => void
}) {
  const { t } = useTranslation()
  const mutations = useAccessMutations()
  const { notify } = useToast()
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [copyPermissions, setCopyPermissions] = useState(true)
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<{ displayName?: string; description?: string; reason?: string }>({})

  useEffect(() => {
    if (!open) return
    setDisplayName('')
    setDescription('')
    setCopyPermissions(true)
    setReason('')
    setErrors({})
  }, [open])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: typeof errors = {}
    if (!displayName.trim()) nextErrors.displayName = t('access:nameRequired')
    else if (displayName.trim().length > 150) nextErrors.displayName = t('access:nameTooLong')
    if (description.trim().length > 1000) nextErrors.description = t('access:descriptionTooLong')
    if (!reason.trim()) nextErrors.reason = t('access:reasonRequired')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    try {
      const saved = await mutations.cloneRole.mutateAsync({
        roleId: role.id,
        body: {
          displayName: displayName.trim(),
          description: description.trim() || null,
          copyPermissions,
          reason: reason.trim(),
        },
      })
      notify(t('access:cloneSuccess'))
      onClose()
      onSuccess(saved)
    } catch {
      notify(t('access:genericError'), 'error')
    }
  }

  return (
    <OverlayDialog
      open={open}
      onClose={() => !mutations.cloneRole.isPending && onClose()}
      title={t('access:cloneRole')}
      description={t('access:cloneDescription', { name: roleName })}
      variant="drawer"
      footer={<>
        <button type="button" className="button button--secondary" onClick={onClose} disabled={mutations.cloneRole.isPending}>{t('cancel')}</button>
        <button type="submit" form="clone-role-form" className="button button--primary" disabled={mutations.cloneRole.isPending}>{mutations.cloneRole.isPending ? t('saving') : t('access:cloneRole')}</button>
      </>}
    >
      <form id="clone-role-form" className="form-stack clone-role-form" onSubmit={(event) => void submit(event)} noValidate>
        <Field label={t('access:newRoleName')} error={errors.displayName} required><input value={displayName} maxLength={150} onChange={(event) => setDisplayName(event.target.value)} /></Field>
        <Field label={t('access:description')} error={errors.description}><textarea value={description} maxLength={1000} rows={5} onChange={(event) => setDescription(event.target.value)} /></Field>
        <label className="switch-row"><input type="checkbox" checked={copyPermissions} onChange={(event) => setCopyPermissions(event.target.checked)} /><span className="switch" aria-hidden="true" /><span>{t('access:copyAllPermissions', { count: role.permissionCount })}</span></label>
        <Field label={t('access:cloneReason')} error={errors.reason} required><textarea value={reason} maxLength={500} rows={4} onChange={(event) => setReason(event.target.value)} placeholder={t('access:cloneReasonPlaceholder')} /></Field>
        <div className="inline-alert inline-alert--neutral"><KeyRound size={18} aria-hidden="true" />{t('access:generatedCodeNote')}</div>
      </form>
    </OverlayDialog>
  )
}
