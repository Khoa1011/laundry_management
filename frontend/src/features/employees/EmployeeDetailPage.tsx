import { ArrowLeft, BriefcaseBusiness, Building2, CalendarDays, Check, CircleUserRound, Clock3, History, KeyRound, Mail, MapPin, Pencil, Phone, Plus, ShieldAlert, Star, Trash2, Unlink, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { ConfirmDialog, OverlayDialog } from '../../components/OverlayDialog'
import { ErrorState, LoadingState, PermissionDeniedState, StatePanel } from '../../components/States'
import { useToast } from '../../providers/ToastProvider'
import { formatVietnamAddress } from '../locations/format'
import {
  useAssignEmployeeBranch, useAssignEmployeePosition, useChangeEmployeeStatus, useEmployee,
  useEmployeeAccountOptions, useEmployeeAudit, useEmployeeBranchOptions, useEmployeePositions,
  useLinkEmployeeAccount, useMakePrimaryEmployeeBranch, useMyEmployeeProfile,
  useRemoveEmployeeBranch, useUnlinkEmployeeAccount,
} from './api'
import { EmployeeAccountBadge, EmployeeStatusBadge } from './EmployeeBadges'
import { EmployeeSensitiveSections } from './EmployeeSensitiveSections'
import { employeePositionName } from './format'
import type { EmployeeBranch, EmployeeDetail, EmployeeSelfProfile, EmployeeStatus } from './types'

type DialogName = 'status' | 'position' | 'branch' | 'account' | null

export function EmployeeDetailPage() {
  const { employeeId: rawId } = useParams()
  const employeeId = Number(rawId)
  const query = useEmployee(Number.isFinite(employeeId) ? employeeId : null)
  const { t } = useTranslation()
  if (query.isPending) return <div className="page-container"><LoadingState /></div>
  if (query.error instanceof ApiError && query.error.status === 403) return <div className="page-container"><PermissionDeniedState /></div>
  if (query.error instanceof ApiError && query.error.status === 404) return <div className="page-container"><StatePanel title={t('employee:notFoundTitle')} body={t('employee:notFoundBody')} action={<Link className="button button--secondary" to="/employees">{t('back')}</Link>} /></div>
  if (query.isError || !query.data) return <div className="page-container"><ErrorState title={t('employee:detailErrorTitle')} body={t('employee:detailErrorBody')} onRetry={() => void query.refetch()} /></div>
  return <EmployeeProfile employee={query.data} />
}

export function EmployeeSelfPage() {
  const query = useMyEmployeeProfile()
  const { t } = useTranslation()
  if (query.isPending) return <div className="page-container"><LoadingState /></div>
  if (query.error instanceof ApiError && query.error.status === 403) return <div className="page-container"><PermissionDeniedState /></div>
  if (query.error instanceof ApiError && query.error.status === 404) return <div className="page-container"><StatePanel title={t('employee:notFoundTitle')} body={t('employee:notFoundBody')} /></div>
  if (query.isError || !query.data) return <div className="page-container"><ErrorState title={t('employee:detailErrorTitle')} body={t('employee:detailErrorBody')} onRetry={() => void query.refetch()} /></div>
  return <EmployeeSelfProfileView employee={query.data} />
}

function EmployeeProfile({ employee }: { employee: EmployeeDetail }) {
  const { t, i18n } = useTranslation()
  const { hasPermission } = useAuth()
  const { notify } = useToast()
  const [dialog, setDialog] = useState<DialogName>(null)
  const [selectedBranch, setSelectedBranch] = useState<EmployeeBranch | null>(null)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [unlinkOpen, setUnlinkOpen] = useState(false)
  const removeMutation = useRemoveEmployeeBranch(employee.id)
  const primaryMutation = useMakePrimaryEmployeeBranch(employee.id)
  const unlinkMutation = useUnlinkEmployeeAccount(employee.id)
  const canUpdate = hasPermission(PERMISSION_CODES.EMPLOYEE_UPDATE)
  const canStatus = hasPermission(PERMISSION_CODES.EMPLOYEE_STATUS_CHANGE)
  const canPosition = hasPermission(PERMISSION_CODES.EMPLOYEE_POSITION_ASSIGN)
  const canAssignBranch = hasPermission(PERMISSION_CODES.EMPLOYEE_BRANCH_ASSIGN)
  const canRemoveBranch = hasPermission(PERMISSION_CODES.EMPLOYEE_BRANCH_REMOVE)
    && (employee.branches.length > 1 || employee.status === 'TERMINATED')
  const canLink = hasPermission(PERMISSION_CODES.EMPLOYEE_ACCOUNT_LINK)
  const canUnlink = hasPermission(PERMISSION_CODES.EMPLOYEE_ACCOUNT_UNLINK)
  const canAudit = hasPermission(PERMISSION_CODES.EMPLOYEE_AUDIT_READ)

  const makePrimary = async (branch: EmployeeBranch) => {
    try { await primaryMutation.mutateAsync({ branchId: branch.id, version: employee.version }); notify(t('employee:branchSuccess')) } catch { notify(t('errors:genericBody'), 'error') }
  }
  const removeBranch = async () => {
    if (!selectedBranch) return
    try { await removeMutation.mutateAsync({ branchId: selectedBranch.id, version: employee.version }); notify(t('employee:branchSuccess')); setRemoveOpen(false) } catch { notify(t('errors:genericBody'), 'error') }
  }
  const unlink = async () => {
    try { await unlinkMutation.mutateAsync({ version: employee.version }); notify(t('employee:accountSuccess')); setUnlinkOpen(false) } catch { notify(t('errors:genericBody'), 'error') }
  }

  return <div className="page-container employee-detail-page">
    <header className="employee-detail-header"><div className="employee-detail-header__nav"><Link to="/employees" className="icon-button" aria-label={t('back')}><ArrowLeft size={20} /></Link><div><p className="eyebrow">{t('employee:profile')}</p><h1>{employee.fullName}</h1><p>{employee.employeeCode}</p></div></div><div className="employee-detail-header__actions">{canUpdate && <Link className="button button--secondary" to={`/employees/${employee.id}/edit`}><Pencil size={17} />{t('employee:editProfile')}</Link>}{canStatus && <button className="button button--primary" onClick={() => setDialog('status')}><ShieldAlert size={17} />{t('employee:changeStatus')}</button>}</div></header>
    <div className="employee-profile-summary"><span className="avatar employee-avatar">{initials(employee.fullName)}</span><div><h2>{employee.fullName}</h2><p>{employeePositionName(employee.position, i18n.language)}</p><div className="employee-profile-summary__badges"><EmployeeStatusBadge status={employee.status} t={t} /><EmployeeAccountBadge status={employee.account?.status ?? 'NO_ACCOUNT'} t={t} /></div></div></div>

    <EmployeeSensitiveSections employeeId={employee.id} />

    <div className="employee-detail-layout"><div className="employee-detail-main">
      <ProfileSection title={t('employee:basicInfo')} icon={<UserRound size={19} />}><dl className="employee-facts"><Fact label={t('employee:phone')} value={employee.phone ?? t('employee:noPhone')} icon={<Phone size={17} />} /><Fact label={t('employee:email')} value={employee.email ?? t('employee:noEmail')} icon={<Mail size={17} />} /><Fact label={t('employee:birthDate')} value={employee.birthDate ? formatDate(employee.birthDate, i18n.language) : t('notAvailable')} icon={<CalendarDays size={17} />} /><Fact label={t('employee:address')} value={formatVietnamAddress(employee) || t('employee:noAddress')} icon={<MapPin size={17} />} wide /></dl></ProfileSection>
      <ProfileSection title={t('employee:employment')} icon={<BriefcaseBusiness size={19} />} action={canPosition ? <button className="text-button" onClick={() => setDialog('position')}><Pencil size={15} />{t('employee:changePosition')}</button> : undefined}><dl className="employee-facts"><Fact label={t('employee:position')} value={employeePositionName(employee.position, i18n.language)} /><Fact label={t('employee:hireDate')} value={formatDate(employee.hireDate, i18n.language)} /><Fact label={t('status')} value={<EmployeeStatusBadge status={employee.status} t={t} />} /></dl></ProfileSection>
      <ProfileSection title={t('employee:branchAssignments')} icon={<Building2 size={19} />} action={canAssignBranch ? <button className="button button--create" onClick={() => setDialog('branch')}><Plus size={17} aria-hidden="true" />{t('employee:addBranch')}</button> : undefined}><div className="employee-branch-list">{employee.branches.map((branch) => <article className="employee-branch-row" key={branch.id}><span className="employee-branch-row__icon"><Building2 size={18} /></span><span><strong>{branch.name}</strong><small>{branch.code}</small></span>{branch.primary && <span className="employee-primary-label"><Star size={14} />{t('employee:primaryBranch')}</span>}<div className="employee-branch-row__actions">{canAssignBranch && !branch.primary && <button className="icon-button" title={t('employee:makePrimary')} aria-label={t('employee:makePrimary')} onClick={() => void makePrimary(branch)}><Star size={17} /></button>}{canRemoveBranch && <button className="icon-button icon-button--danger" title={t('employee:removeBranch')} aria-label={t('employee:removeBranch')} onClick={() => { setSelectedBranch(branch); setRemoveOpen(true) }}><Trash2 size={17} /></button>}</div></article>)}</div></ProfileSection>
      {canAudit && <EmployeeAuditSection employeeId={employee.id} />}
    </div><aside className="employee-detail-aside">
      <ProfileSection title={t('employee:accountAccess')} icon={<KeyRound size={19} />}>{employee.account ? <div className="employee-account-panel"><div><strong>{employee.account.displayName}</strong><small>@{employee.account.username}</small></div><EmployeeAccountBadge status={employee.account.status} t={t} /><div className="employee-account-branches">{employee.account.branchAccess.map((branch) => <span key={branch.id}>{branch.name}</span>)}</div>{canUnlink && <button className="button button--secondary" onClick={() => setUnlinkOpen(true)}><Unlink size={17} />{t('employee:unlinkAccount')}</button>}</div> : <div className="employee-empty-inline"><CircleUserRound size={28} /><p>{t('employee:noAccount')}</p>{canLink && <button className="button button--secondary" onClick={() => setDialog('account')}><KeyRound size={17} />{t('employee:linkAccount')}</button>}</div>}</ProfileSection>
      <ProfileSection title={t('employee:code')} icon={<Clock3 size={19} />}><dl className="employee-metadata"><div><dt>{t('employee:code')}</dt><dd>{employee.employeeCode}</dd></div><div><dt>{t('employee:updatedOn', { date: '' }).trim()}</dt><dd>{formatDateTime(employee.updatedAt, i18n.language)}</dd></div></dl></ProfileSection>
    </aside></div>
    <StatusDialog open={dialog === 'status'} onClose={() => setDialog(null)} employee={employee} />
    <PositionDialog open={dialog === 'position'} onClose={() => setDialog(null)} employee={employee} />
    <BranchDialog open={dialog === 'branch'} onClose={() => setDialog(null)} employee={employee} />
    <AccountDialog open={dialog === 'account'} onClose={() => setDialog(null)} employee={employee} />
    <ConfirmDialog open={removeOpen} onClose={() => setRemoveOpen(false)} onConfirm={() => void removeBranch()} title={t('employee:confirmRemoveBranchTitle')} body={t('employee:confirmRemoveBranchBody')} confirmLabel={t('employee:removeBranch')} pending={removeMutation.isPending} tone="danger" />
    <ConfirmDialog open={unlinkOpen} onClose={() => setUnlinkOpen(false)} onConfirm={() => void unlink()} title={t('employee:confirmUnlinkTitle')} body={t('employee:confirmUnlinkBody')} confirmLabel={t('employee:unlinkAccount')} pending={unlinkMutation.isPending} tone="danger" />
  </div>
}

function EmployeeSelfProfileView({ employee }: { employee: EmployeeSelfProfile }) {
  const { t, i18n } = useTranslation()
  return <div className="page-container employee-detail-page"><header className="employee-detail-header"><div className="employee-detail-header__nav"><Link to="/overview" className="icon-button" aria-label={t('back')}><ArrowLeft size={20} /></Link><div><p className="eyebrow">{t('employee:selfTitle')}</p><h1>{employee.fullName}</h1><p>{employee.employeeCode}</p></div></div></header><div className="employee-profile-summary"><span className="avatar employee-avatar">{initials(employee.fullName)}</span><div><h2>{employee.fullName}</h2><p>{employeePositionName(employee.position, i18n.language)}</p><div className="employee-profile-summary__badges"><EmployeeStatusBadge status={employee.status} t={t} /><EmployeeAccountBadge status={employee.accountStatus} t={t} /></div></div></div><div className="employee-detail-main"><ProfileSection title={t('employee:basicInfo')} icon={<UserRound size={19} />}><dl className="employee-facts"><Fact label={t('employee:phone')} value={employee.phone ?? t('employee:noPhone')} icon={<Phone size={17} />} /><Fact label={t('employee:email')} value={employee.email ?? t('employee:noEmail')} icon={<Mail size={17} />} /><Fact label={t('employee:birthDate')} value={employee.birthDate ? formatDate(employee.birthDate, i18n.language) : t('notAvailable')} icon={<CalendarDays size={17} />} /><Fact label={t('employee:address')} value={formatVietnamAddress(employee) || t('employee:noAddress')} icon={<MapPin size={17} />} wide /></dl></ProfileSection><ProfileSection title={t('employee:employment')} icon={<BriefcaseBusiness size={19} />}><dl className="employee-facts"><Fact label={t('employee:position')} value={employeePositionName(employee.position, i18n.language)} /><Fact label={t('employee:hireDate')} value={formatDate(employee.hireDate, i18n.language)} /><Fact label={t('status')} value={<EmployeeStatusBadge status={employee.status} t={t} />} /></dl></ProfileSection><ProfileSection title={t('employee:branchAssignments')} icon={<Building2 size={19} />}><div className="employee-branch-list">{employee.branches.map((branch) => <article className="employee-branch-row" key={branch.id}><span className="employee-branch-row__icon"><Building2 size={18} /></span><span><strong>{branch.name}</strong><small>{branch.code}</small></span>{branch.primary && <span className="employee-primary-label"><Star size={14} />{t('employee:primaryBranch')}</span>}</article>)}</div></ProfileSection></div></div>
}

function StatusDialog({ open, onClose, employee }: { open: boolean; onClose: () => void; employee: EmployeeDetail }) {
  const { t } = useTranslation(); const { notify } = useToast(); const [status, setStatus] = useState<EmployeeStatus>(employee.status); const [reason, setReason] = useState(''); const mutation = useChangeEmployeeStatus(employee.id)
  const needsReason = status === 'SUSPENDED' || status === 'TERMINATED'
  useEffect(() => { if (open) { setStatus(employee.status); setReason('') } }, [employee.status, open])
  const submit = async () => { if (needsReason && !reason.trim()) return; try { await mutation.mutateAsync({ status, reason: reason.trim() || undefined, version: employee.version }); notify(t('employee:statusSuccess')); onClose() } catch { notify(t('errors:genericBody'), 'error') } }
  return <OverlayDialog open={open} onClose={onClose} title={t('employee:statusDialogTitle')} footer={<><button className="button button--secondary" onClick={onClose}>{t('cancel')}</button><button className={`button ${status === 'TERMINATED' ? 'button--danger' : 'button--primary'}`} onClick={() => void submit()} disabled={mutation.isPending || status === employee.status || (needsReason && !reason.trim())}>{mutation.isPending ? t('saving') : t('confirm')}</button></>}><div className="form-stack"><label className="field"><span>{t('status')}</span><select value={status} onChange={(event) => setStatus(event.target.value as EmployeeStatus)}><option value="ACTIVE">{t('employee:active')}</option><option value="INACTIVE">{t('employee:inactive')}</option><option value="SUSPENDED">{t('employee:suspended')}</option><option value="TERMINATED">{t('employee:terminated')}</option></select></label><label className="field"><span>{t('employee:statusReason')}{needsReason ? ' *' : ''}</span><textarea rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /><small>{t('employee:statusReasonHint')}</small></label>{status === 'TERMINATED' && <div className="inline-alert inline-alert--danger"><ShieldAlert size={18} />{t('employee:terminatedWarning')}</div>}{needsReason && employee.account && <div className="inline-alert inline-alert--warning"><ShieldAlert size={18} />{t('employee:statusLockWarning')}</div>}</div></OverlayDialog>
}

function PositionDialog({ open, onClose, employee }: { open: boolean; onClose: () => void; employee: EmployeeDetail }) {
  const { t, i18n } = useTranslation(); const { notify } = useToast(); const positions = useEmployeePositions(); const [positionId, setPositionId] = useState(employee.position.id); const mutation = useAssignEmployeePosition(employee.id)
  useEffect(() => { if (open) setPositionId(employee.position.id) }, [employee.position.id, open])
  const submit = async () => { try { await mutation.mutateAsync({ positionId, version: employee.version }); notify(t('employee:positionSuccess')); onClose() } catch { notify(t('errors:genericBody'), 'error') } }
  return <OverlayDialog open={open} onClose={onClose} title={t('employee:positionDialogTitle')} footer={<><button className="button button--secondary" onClick={onClose}>{t('cancel')}</button><button className="button button--primary" onClick={() => void submit()} disabled={mutation.isPending || positionId === employee.position.id}>{mutation.isPending ? t('saving') : t('confirm')}</button></>}><label className="field"><span>{t('employee:position')}</span><select value={positionId} onChange={(event) => setPositionId(Number(event.target.value))}>{positions.data?.map((position) => <option key={position.id} value={position.id}>{employeePositionName(position, i18n.language)}</option>)}</select></label></OverlayDialog>
}

function BranchDialog({ open, onClose, employee }: { open: boolean; onClose: () => void; employee: EmployeeDetail }) {
  const { t } = useTranslation(); const { notify } = useToast(); const branches = useEmployeeBranchOptions(); const available = branches.data?.filter((branch) => !employee.branches.some((item) => item.id === branch.id)) ?? []; const [branchId, setBranchId] = useState(0); const [primary, setPrimary] = useState(false); const mutation = useAssignEmployeeBranch(employee.id)
  useEffect(() => { if (open) { setBranchId(0); setPrimary(false) } }, [open])
  const submit = async () => { if (!branchId) return; try { await mutation.mutateAsync({ branchId, primary, version: employee.version }); notify(t('employee:branchSuccess')); onClose() } catch { notify(t('errors:genericBody'), 'error') } }
  return <OverlayDialog open={open} onClose={onClose} title={t('employee:branchDialogTitle')} footer={<><button className="button button--secondary" onClick={onClose}>{t('cancel')}</button><button className="button button--create" onClick={() => void submit()} disabled={mutation.isPending || !branchId}>{!mutation.isPending && <Plus size={18} aria-hidden="true" />}{mutation.isPending ? t('saving') : t('employee:addBranch')}</button></>}><div className="form-stack"><label className="field"><span>{t('employee:branches')}</span><select value={branchId} onChange={(event) => setBranchId(Number(event.target.value))}><option value={0}>{t('employee:allBranches')}</option>{available.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="switch-row"><input type="checkbox" checked={primary} onChange={(event) => setPrimary(event.target.checked)} /><span className="switch" aria-hidden="true" /><span>{t('employee:primaryBranch')}</span></label></div></OverlayDialog>
}

function AccountDialog({ open, onClose, employee }: { open: boolean; onClose: () => void; employee: EmployeeDetail }) {
  const { t } = useTranslation(); const { notify } = useToast(); const [search, setSearch] = useState(''); const [userId, setUserId] = useState(0); const accounts = useEmployeeAccountOptions(employee.id, search, open); const mutation = useLinkEmployeeAccount(employee.id)
  useEffect(() => { if (open) { setSearch(''); setUserId(0) } }, [open])
  const submit = async () => { if (!userId) return; try { await mutation.mutateAsync({ userId, version: employee.version }); notify(t('employee:accountSuccess')); onClose() } catch { notify(t('errors:genericBody'), 'error') } }
  return <OverlayDialog open={open} onClose={onClose} title={t('employee:accountDialogTitle')} footer={<><button className="button button--secondary" onClick={onClose}>{t('cancel')}</button><button className="button button--primary" onClick={() => void submit()} disabled={mutation.isPending || !userId}>{mutation.isPending ? t('saving') : t('employee:linkAccount')}</button></>}><div className="form-stack"><label className="field"><span>{t('employee:accountSearch')}</span><input value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="employee-account-options">{accounts.isPending ? <LoadingState rows={3} /> : accounts.data?.items.length ? accounts.data.items.map((account) => <label className={userId === account.id ? 'selected' : ''} key={account.id}><input type="radio" name="employeeAccount" checked={userId === account.id} onChange={() => setUserId(account.id)} /><span><strong>{account.displayName}</strong><small>@{account.username}</small></span><EmployeeAccountBadge status={account.status} t={t} />{userId === account.id && <Check size={18} />}</label>) : <StatePanel compact title={t('employee:noAccount')} body={t('employee:accountScopeWarning')} />}</div><div className="inline-alert inline-alert--warning"><KeyRound size={18} />{t('employee:accountScopeWarning')}</div></div></OverlayDialog>
}

function EmployeeAuditSection({ employeeId }: { employeeId: number }) {
  const { t, i18n } = useTranslation(); const query = useEmployeeAudit(employeeId, true)
  return <ProfileSection title={t('employee:audit')} icon={<History size={19} />}>{query.isPending ? <LoadingState rows={3} /> : query.isError ? <ErrorState title={t('employee:detailErrorTitle')} body={t('employee:detailErrorBody')} onRetry={() => void query.refetch()} /> : query.data?.items.length ? <ol className="employee-audit-list">{query.data.items.map((item) => <li key={item.id}><span className="employee-audit-list__marker" /><div><strong>{t(`employee:auditActions.${item.action}`, { defaultValue: item.action })}</strong><p>{item.actor.displayName}{item.branch ? ` · ${item.branch.name}` : ''}</p>{item.reason && <p className="employee-audit-reason">{item.reason}</p>}<time>{formatDateTime(item.createdAt, i18n.language)}</time></div></li>)}</ol> : <p className="employee-empty-copy">{t('employee:noAudit')}</p>}</ProfileSection>
}

function ProfileSection({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) { return <section className="employee-profile-section"><header><span>{icon}</span><h2>{title}</h2>{action && <div>{action}</div>}</header><div className="employee-profile-section__body">{children}</div></section> }
function Fact({ label, value, icon, wide = false }: { label: string; value: ReactNode; icon?: ReactNode; wide?: boolean }) { return <div className={wide ? 'employee-fact--wide' : ''}><dt>{icon}{label}</dt><dd>{value}</dd></div> }
function initials(name: string) { return name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase() }
function formatDate(value: string, language: string) { return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-GB' : 'vi-VN').format(new Date(`${value}T00:00:00`)) }
function formatDateTime(value: string, language: string) { return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-GB' : 'vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
