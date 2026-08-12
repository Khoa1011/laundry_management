import { ArrowLeft, BookKey, ChevronRight, ClipboardClock, Search, ShieldCheck, UserCog, UsersRound } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { ErrorState, LoadingState, PermissionDeniedState, StatePanel } from '../../components/States'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../providers/ToastProvider'
import { useAccessAudit, useAccessMutations, usePermissionModules, useRoleMatrix, useRoles, useUserAccess, useUsers } from './api'
import type { OverrideEffect, PermissionModule, RiskLevel } from './types'

const copy = {
  vi: {
    title: 'Phân quyền và truy cập', subtitle: 'Quản lý vai trò, quyền hiệu lực và ngoại lệ người dùng từ một nơi.',
    roles: 'Vai trò', rolesBody: 'Thiết lập bộ quyền mặc định theo trách nhiệm công việc.',
    users: 'Truy cập người dùng', usersBody: 'Gán vai trò và xử lý ngoại lệ ALLOW / DENY có kiểm soát.',
    catalog: 'Danh mục quyền', catalogBody: 'Tra cứu quyền theo mô-đun và mức độ rủi ro.',
    audit: 'Nhật ký phân quyền', auditBody: 'Theo dõi ai đã thay đổi quyền gì và lý do.',
    search: 'Tìm theo tên, mã hoặc tài khoản', addRole: 'Tạo vai trò', editRole: 'Chỉnh sửa vai trò',
    cloneRole: 'Sao chép vai trò', matrix: 'Ma trận quyền', permissions: 'quyền', members: 'người dùng',
    code: 'Mã vai trò', nameVi: 'Tên tiếng Việt', nameEn: 'Tên tiếng Anh', descriptionVi: 'Mô tả tiếng Việt',
    descriptionEn: 'Mô tả tiếng Anh', reason: 'Lý do thay đổi', save: 'Lưu thay đổi', create: 'Tạo vai trò',
    active: 'Đang hoạt động', inactive: 'Ngừng hoạt động', system: 'Vai trò hệ thống',
    noRoles: 'Chưa có vai trò phù hợp', noUsers: 'Không tìm thấy người dùng phù hợp',
    assigned: 'Đã gán', notAssigned: 'Chưa gán', highRisk: 'Rủi ro cao', selectAll: 'Chọn cả nhóm',
    effective: 'Quyền hiệu lực', roleDefault: 'Theo vai trò', allow: 'Cho phép riêng', deny: 'Từ chối riêng',
    inherit: 'Kế thừa vai trò', overrideReason: 'Lý do ngoại lệ', role: 'Vai trò chính',
    saveRole: 'Lưu vai trò', saveOverrides: 'Lưu ngoại lệ', changed: 'Đã lưu cấu hình phân quyền.',
    conflict: 'Dữ liệu đã được người khác cập nhật. Hãy tải lại trước khi lưu.',
    loadError: 'Không thể tải dữ liệu phân quyền.', auditEmpty: 'Chưa có thay đổi phân quyền nào.',
    back: 'Quay lại', actor: 'Người thực hiện', action: 'Thao tác', target: 'Đối tượng', time: 'Thời gian',
    permissionCatalog: 'Danh mục quyền', viewDetails: 'Xem chi tiết', summary: 'Tổng quan truy cập',
    precedence: 'DENY ưu tiên hơn ALLOW và vai trò.', overrides: 'ngoại lệ',
  },
  en: {
    title: 'Access control', subtitle: 'Manage roles, effective permissions, and user exceptions in one place.',
    roles: 'Roles', rolesBody: 'Define default permission sets for job responsibilities.',
    users: 'User access', usersBody: 'Assign roles and manage controlled ALLOW / DENY exceptions.',
    catalog: 'Permission catalog', catalogBody: 'Browse permissions by module and risk.',
    audit: 'Authorization audit', auditBody: 'See who changed access, what changed, and why.',
    search: 'Search by name, code, or username', addRole: 'Create role', editRole: 'Edit role',
    cloneRole: 'Clone role', matrix: 'Permission matrix', permissions: 'permissions', members: 'users',
    code: 'Role code', nameVi: 'Vietnamese name', nameEn: 'English name', descriptionVi: 'Vietnamese description',
    descriptionEn: 'English description', reason: 'Reason for change', save: 'Save changes', create: 'Create role',
    active: 'Active', inactive: 'Inactive', system: 'System role', noRoles: 'No matching roles',
    noUsers: 'No matching users', assigned: 'Assigned', notAssigned: 'Not assigned', highRisk: 'High risk',
    selectAll: 'Select module', effective: 'Effective access', roleDefault: 'Role default',
    allow: 'User allow', deny: 'User deny', inherit: 'Inherit role', overrideReason: 'Override reason',
    role: 'Primary role', saveRole: 'Save role', saveOverrides: 'Save overrides',
    changed: 'Access configuration saved.', conflict: 'This data changed. Reload before saving.',
    loadError: 'Unable to load access-control data.', auditEmpty: 'No authorization changes yet.',
    back: 'Back', actor: 'Actor', action: 'Action', target: 'Target', time: 'Time',
    permissionCatalog: 'Permission catalog', viewDetails: 'View details', summary: 'Access overview',
    precedence: 'DENY takes precedence over ALLOW and role grants.', overrides: 'overrides',
  },
} as const

function useCopy() {
  const language = document.documentElement.lang === 'en' ? 'en' : 'vi'
  return copy[language]
}

function AccessHeader({ title, subtitle, back, action }: { title: string; subtitle?: string; back?: string; action?: ReactNode }) {
  const { t } = useTranslation()
  return <header className="page-header access-header"><div className="access-heading-row">{back && <Link className="icon-button" to={back} aria-label={t('back')}><ArrowLeft size={20} /></Link>}<div><p className="eyebrow">{t('access:administration')}</p><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div></div>{action && <div className="page-header__actions">{action}</div>}</header>
}

function QueryFailure({ error, retry }: { error: unknown; retry: () => void }) {
  const c = useCopy()
  if (error instanceof ApiError && error.status === 403) return <PermissionDeniedState />
  return <ErrorState title={c.loadError} body={error instanceof ApiError ? error.message : c.loadError} onRetry={retry} />
}

export function AccessLandingPage() {
  const c = useCopy()
  const { hasPermission } = useAuth()
  const cards = [
    { to: '/settings/access/roles', title: c.roles, body: c.rolesBody, icon: ShieldCheck, permission: PERMISSION_CODES.ACCESS_ROLE_READ },
    { to: '/settings/access/users', title: c.users, body: c.usersBody, icon: UserCog, permission: PERMISSION_CODES.ACCESS_USER_READ },
    { to: '/settings/access/permissions', title: c.catalog, body: c.catalogBody, icon: BookKey, permission: PERMISSION_CODES.ACCESS_PERMISSION_READ },
    { to: '/settings/access/audit', title: c.audit, body: c.auditBody, icon: ClipboardClock, permission: PERMISSION_CODES.ACCESS_AUDIT_READ },
  ].filter((item) => hasPermission(item.permission))
  return <div className="page-container access-page"><AccessHeader title={c.title} subtitle={c.subtitle} /><section className="access-overview-grid">{cards.map(({ to, title, body, icon: Icon }) => <Link to={to} className="access-overview-card" key={to}><span className="section-icon"><Icon size={21} /></span><span><strong>{title}</strong><small>{body}</small></span><ChevronRight size={20} /></Link>)}</section></div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="form-field"><span className="form-field__label">{label}</span>{children}</label>
}

export function RoleMatrixPage() {
  const { t, i18n } = useTranslation()
  const { roleId } = useParams()
  const id = Number(roleId)
  const query = useRoleMatrix(id)
  const mutations = useAccessMutations()
  const { notify } = useToast()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reason, setReason] = useState('')
  useEffect(() => { if (query.data) setSelected(new Set(query.data.permissionCodes)) }, [query.data])
  const toggle = (code: string) => setSelected((current) => { const next = new Set(current); if (next.has(code)) next.delete(code); else next.add(code); return next })
  const toggleModule = (module: PermissionModule) => setSelected((current) => {
    const next = new Set(current)
    const all = module.permissions.every((permission) => next.has(permission.code))
    module.permissions.forEach((permission) => all ? next.delete(permission.code) : next.add(permission.code))
    return next
  })
  const save = async () => {
    if (!query.data || !reason.trim()) return
    try {
      await mutations.saveMatrix.mutateAsync({ roleId: id, body: { permissionCodes: [...selected], version: query.data.version, reason } })
      notify(t('access:updateSuccess')); setReason('')
    } catch (error) { notify(error instanceof ApiError && error.status === 409 ? t('access:conflict') : t('access:genericError'), 'error') }
  }
  if (query.isPending) return <div className="page-container"><LoadingState /></div>
  if (query.isError) return <div className="page-container"><QueryFailure error={query.error} retry={() => void query.refetch()} /></div>
  const language = i18n.language
  const roleName = query.data.role.system
    ? (language.startsWith('en') ? query.data.role.nameEn : query.data.role.nameVi)
    : query.data.role.displayName
  return <div className="page-container form-page access-page access-matrix-page"><AccessHeader title={t('access:permissionSummary')} subtitle={`${roleName} · ${t('access:permissionCount', { count: selected.size })}`} back={`/settings/access/roles/${id}`} />
    <div className="access-matrix">{query.data.modules.map((module) => <section className="permission-module" key={module.module}><header><label className="permission-check"><input type="checkbox" checked={module.permissions.every((item) => selected.has(item.code))} onChange={() => toggleModule(module)} /><span><strong>{language.startsWith('en') ? module.nameEn : module.nameVi}</strong><small>{t('access:permissionCount', { count: module.permissions.length })}</small></span></label></header><div>{module.permissions.map((permission) => <label className="permission-row" key={permission.code}><input type="checkbox" checked={selected.has(permission.code)} onChange={() => toggle(permission.code)} /><span><strong>{language.startsWith('en') ? permission.nameEn : permission.nameVi}</strong><small>{permission.code}</small><small>{language.startsWith('en') ? permission.descriptionEn || permission.descriptionVi : permission.descriptionVi || permission.descriptionEn}</small></span><RiskBadge risk={permission.riskLevel} /></label>)}</div></section>)}</div>
    <div className="sticky-action-bar access-matrix-save"><Field label={t('access:reason')}><input required value={reason} onChange={(e) => setReason(e.target.value)} /></Field><Button onClick={() => void save()} disabled={!reason.trim() || mutations.saveMatrix.isPending}>{t('access:saveChanges')}</Button></div>
  </div>
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <span className={`badge access-risk access-risk--${risk.toLowerCase()}`}>{risk}</span>
}

export function UserListPage() {
  const c = useCopy()
  const { i18n } = useTranslation()
  const english = i18n.language.startsWith('en')
  const [search, setSearch] = useState('')
  const query = useUsers(search)
  return <div className="page-container access-page"><AccessHeader title={c.users} subtitle={c.usersBody} back="/settings/access" /><label className="search-input access-search"><Search size={19} /><input aria-label={c.search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={c.search} /></label>
    {query.isPending ? <LoadingState rows={5} /> : query.isError ? <QueryFailure error={query.error} retry={() => void query.refetch()} /> : query.data.items.length === 0 ? <StatePanel icon={<UsersRound />} title={c.noUsers} body={c.usersBody} /> : <div className="access-user-grid">{query.data.items.map((user) => <Link className="access-user-card" to={`/settings/access/users/${user.id}`} key={user.id}><span className="avatar avatar--large">{user.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>@{user.username}</small><small>{user.primaryRole ? (english ? user.primaryRole.nameEn : user.primaryRole.nameVi) : c.notAssigned} · {user.branches.map((branch) => branch.name).join(', ')}</small></span>{user.overrideCount > 0 && <span className="badge access-risk--high">{user.overrideCount} {c.overrides}</span>}<ChevronRight size={20} /></Link>)}</div>}
  </div>
}

export function UserAccessPage() {
  const c = useCopy()
  const { i18n } = useTranslation()
  const english = i18n.language.startsWith('en')
  const { userId } = useParams()
  const id = Number(userId)
  const { hasPermission } = useAuth()
  const query = useUserAccess(id)
  const roles = useRoles('', 100)
  const modules = usePermissionModules()
  const mutations = useAccessMutations()
  const { notify } = useToast()
  const [roleId, setRoleId] = useState('')
  const [roleReason, setRoleReason] = useState('')
  const [draft, setDraft] = useState<Record<string, { effect: '' | OverrideEffect; reason: string }>>({})
  useEffect(() => {
    if (!query.data) return
    setRoleId(query.data.user.primaryRole ? String(query.data.user.primaryRole.id) : '')
    setDraft(Object.fromEntries(query.data.overrides.map((item) => [item.permissionCode, { effect: item.effect, reason: item.reason }])))
  }, [query.data])
  const saveRole = async () => {
    if (!query.data || !roleId || !roleReason.trim()) return
    try { await mutations.assignRole.mutateAsync({ userId: id, body: { roleId: Number(roleId), version: query.data.version, reason: roleReason } }); notify(c.changed); setRoleReason('') } catch (error) { notify(error instanceof Error ? error.message : c.loadError, 'error') }
  }
  const saveOverrides = async () => {
    if (!query.data) return
    const overrides = Object.entries(draft).filter(([, value]) => value.effect).map(([permissionCode, value]) => ({ permissionCode, effect: value.effect, reason: value.reason || c.overrideReason }))
    try { await mutations.saveOverrides.mutateAsync({ userId: id, body: { overrides, version: query.data.version } }); notify(c.changed) } catch (error) { notify(error instanceof Error ? error.message : c.loadError, 'error') }
  }
  if (query.isPending || roles.isPending || modules.isPending) return <div className="page-container"><LoadingState /></div>
  if (query.isError) return <div className="page-container"><QueryFailure error={query.error} retry={() => void query.refetch()} /></div>
  return <div className="page-container form-page access-page"><AccessHeader title={query.data.user.displayName} subtitle={`@${query.data.user.username} · v${query.data.authorizationVersion}`} back="/settings/access/users" />
    <section className="form-section"><h2>{c.role}</h2><div className="access-inline-form"><Field label={c.role}><select value={roleId} disabled={!hasPermission(PERMISSION_CODES.ACCESS_USER_ROLE_ASSIGN)} onChange={(e) => setRoleId(e.target.value)}><option value="">{c.notAssigned}</option>{roles.data?.items.filter((role) => role.status === 'ACTIVE').map((role) => <option value={role.id} key={role.id}>{role.nameVi} ({role.code})</option>)}</select></Field><Field label={c.reason}><input value={roleReason} disabled={!hasPermission(PERMISSION_CODES.ACCESS_USER_ROLE_ASSIGN)} onChange={(e) => setRoleReason(e.target.value)} /></Field><Button disabled={!roleReason.trim() || mutations.assignRole.isPending} onClick={() => void saveRole()}>{c.saveRole}</Button></div></section>
    <section className="form-section"><div className="section-header"><div><h2>{c.effective}</h2><p>{query.data.effectivePermissions.length} {c.permissions} · {c.precedence}</p></div></div>
      <div className="override-modules">{modules.data?.map((module) => <details className="override-module" key={module.module} open><summary>{english ? module.nameEn : module.nameVi}<span>{module.permissions.length}</span></summary>{module.permissions.map((permission) => {
        const value = draft[permission.code] ?? { effect: '', reason: '' }
        const decision = query.data.decisions.find((item) => item.permissionCode === permission.code)
        const permissionName = english ? permission.nameEn : permission.nameVi
        return <div className="override-row" key={permission.code}><div><strong>{permissionName}</strong><small>{permission.code}</small><span className={`badge ${decision?.effective ? 'badge--status-active' : 'badge--status-inactive'}`}>{decision?.effective ? c.assigned : c.notAssigned} · {decision?.source ?? 'NONE'}</span></div><select aria-label={`${permissionName} ${c.overrides}`} disabled={!hasPermission(PERMISSION_CODES.ACCESS_USER_PERMISSION_OVERRIDE)} value={value.effect} onChange={(e) => setDraft({ ...draft, [permission.code]: { ...value, effect: e.target.value as '' | OverrideEffect } })}><option value="">{c.inherit}</option><option value="ALLOW">{c.allow}</option><option value="DENY">{c.deny}</option></select>{value.effect && <input aria-label={c.overrideReason} value={value.reason} placeholder={c.overrideReason} onChange={(e) => setDraft({ ...draft, [permission.code]: { ...value, reason: e.target.value } })} />}</div>
      })}</details>)}</div>
      {hasPermission(PERMISSION_CODES.ACCESS_USER_PERMISSION_OVERRIDE) && <div className="access-form-actions"><Button onClick={() => void saveOverrides()} disabled={mutations.saveOverrides.isPending}>{c.saveOverrides}</Button></div>}
    </section>
  </div>
}

export function PermissionCatalogPage() {
  const c = useCopy()
  const { i18n } = useTranslation()
  const english = i18n.language.startsWith('en')
  const query = usePermissionModules()
  return <div className="page-container access-page"><AccessHeader title={c.permissionCatalog} subtitle={c.catalogBody} back="/settings/access" />{query.isPending ? <LoadingState /> : query.isError ? <QueryFailure error={query.error} retry={() => void query.refetch()} /> : <div className="permission-catalog">{query.data.map((module) => <section className="content-card" key={module.module}><div className="section-header"><div><h2>{english ? module.nameEn : module.nameVi}</h2><p>{module.module} · {module.permissions.length} {c.permissions}</p></div></div><div className="catalog-list">{module.permissions.map((permission) => <div key={permission.code}><span><strong>{english ? permission.nameEn : permission.nameVi}</strong><small>{permission.code}</small><small>{english ? permission.descriptionEn || permission.descriptionVi : permission.descriptionVi || permission.descriptionEn}</small></span><RiskBadge risk={permission.riskLevel} /></div>)}</div></section>)}</div>}</div>
}

export function AccessAuditPage() {
  const c = useCopy()
  const query = useAccessAudit()
  return <div className="page-container access-page"><AccessHeader title={c.audit} subtitle={c.auditBody} back="/settings/access" />{query.isPending ? <LoadingState /> : query.isError ? <QueryFailure error={query.error} retry={() => void query.refetch()} /> : query.data.items.length === 0 ? <StatePanel icon={<ClipboardClock />} title={c.auditEmpty} body={c.auditBody} /> : <div className="audit-list">{query.data.items.map((item) => <article key={item.id}><span className="section-icon"><ClipboardClock size={18} /></span><div><strong>{item.action}</strong><p>{c.actor}: {item.actorDisplayName} · {c.target}: {item.targetType} #{item.targetId}</p>{item.reason && <small>{item.reason}</small>}<time>{new Date(item.createdAt).toLocaleString()}</time></div></article>)}</div>}</div>
}
