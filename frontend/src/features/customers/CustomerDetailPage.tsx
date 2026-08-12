import { Activity, ArrowLeft, Building2, CalendarDays, Check, CircleUserRound, Mail, MapPin, MoreHorizontal, Pencil, Phone, Plus, Power, PowerOff, StickyNote } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import type { CustomerActivity, CustomerAddress, CustomerStatus } from '../../api/types'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { ConfirmDialog } from '../../components/OverlayDialog'
import { ErrorState, LoadingState, NotFoundState, PermissionDeniedState, StatePanel } from '../../components/States'
import { useToast } from '../../providers/ToastProvider'
import { AddressDialog } from './AddressDialog'
import { useChangeAddressStatus, useChangeCustomerStatus, useCustomer, useCustomerActivities, useSetDefaultAddress } from './api'
import { formatAddress, formatDate, initials, sourceLabel, statusLabel, typeLabel } from './format'

export function CustomerDetailPage() {
  const { t, i18n } = useTranslation()
  const customerId = Number(useParams().customerId)
  const { branchId, hasPermission } = useAuth()
  const { notify } = useToast()
  const query = useCustomer(Number.isFinite(customerId) ? customerId : null, branchId)
  const [addressDialog, setAddressDialog] = useState<{ open: boolean; address?: CustomerAddress | null }>({ open: false })
  const [statusTarget, setStatusTarget] = useState<CustomerStatus | null>(null)
  const [addressStatusTarget, setAddressStatusTarget] = useState<CustomerAddress | null>(null)
  const [replacementId, setReplacementId] = useState<number | undefined>()
  const [activityPage, setActivityPage] = useState(0)
  const canRead = hasPermission(PERMISSION_CODES.CUSTOMER_READ)
  const canEdit = hasPermission(PERMISSION_CODES.CUSTOMER_UPDATE)
  const canStatus = hasPermission(PERMISSION_CODES.CUSTOMER_DEACTIVATE)
  const canAddress = hasPermission(PERMISSION_CODES.CUSTOMER_ADDRESS_MANAGE)
  const canAudit = hasPermission(PERMISSION_CODES.CUSTOMER_AUDIT_READ)
  const customer = query.data
  const activities = useCustomerActivities(customerId, branchId ?? 0, activityPage, canAudit && Boolean(customer && branchId))
  const statusMutation = useChangeCustomerStatus(customerId, branchId ?? 0)
  const defaultMutation = useSetDefaultAddress(customerId, branchId ?? 0)
  const addressStatusMutation = useChangeAddressStatus(customerId, branchId ?? 0)

  if (!canRead) return <div className="page-container"><PermissionDeniedState /></div>
  if (query.isPending) return <div className="page-container"><LoadingState rows={5} /></div>
  if (query.error instanceof ApiError && query.error.status === 404) return <div className="page-container"><NotFoundState customer /></div>
  if (query.error instanceof ApiError && query.error.status === 403) return <div className="page-container"><PermissionDeniedState /></div>
  if (query.isError || !customer) return <div className="page-container"><ErrorState title={t('customers:detailErrorTitle')} body={t('customers:detailErrorBody')} onRetry={() => void query.refetch()} /></div>

  const activeReplacements = customer.addresses.filter((address) => address.status === 'ACTIVE' && address.id !== addressStatusTarget?.id)
  const changeCustomerStatus = async () => {
    if (!statusTarget) return
    try { await statusMutation.mutateAsync({ status: statusTarget, version: customer.version }); notify(t('customers:statusSuccess')); setStatusTarget(null) } catch { notify(t('errors:genericBody'), 'error') }
  }
  const setDefault = async (address: CustomerAddress) => {
    try { await defaultMutation.mutateAsync({ addressId: address.id, version: address.version }); notify(t('addresses:defaultSuccess')) } catch { notify(t('errors:genericBody'), 'error') }
  }
  const changeAddressStatus = async () => {
    if (!addressStatusTarget) return
    const nextStatus = addressStatusTarget.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try { await addressStatusMutation.mutateAsync({ addressId: addressStatusTarget.id, status: nextStatus, version: addressStatusTarget.version, replacementAddressId: nextStatus === 'INACTIVE' ? replacementId : undefined }); notify(t('addresses:statusSuccess')); setAddressStatusTarget(null); setReplacementId(undefined) } catch (error) { notify(error instanceof ApiError && error.problem.errorCode === 'INVALID_DEFAULT_ADDRESS_REPLACEMENT' ? t('addresses:replacementHint') : t('errors:genericBody'), 'error') }
  }

  return <div className="page-container customer-detail-page">
    <header className="detail-topbar"><Link to="/customers" className="icon-button" aria-label={t('back')}><ArrowLeft size={20} /></Link><div><p className="eyebrow">{customer.customerCode}</p><h1>{customer.fullName}</h1></div>{canEdit && <Link to={`/customers/${customer.id}/edit`} className="button button--secondary"><Pencil size={18} />{t('edit')}</Link>}</header>
    {customer.status === 'INACTIVE' && <div className="inline-alert inline-alert--neutral"><PowerOff size={18} />{statusLabel(customer.status, t)}</div>}
    <div className="detail-grid">
      <section className="profile-card"><span className="avatar avatar--profile">{initials(customer.fullName)}</span><h2>{customer.fullName}</h2><div className="profile-badges"><span className={`badge badge--status-${customer.status.toLowerCase()}`}><span className="badge__dot" />{statusLabel(customer.status, t)}</span><span className={`badge badge--type-${customer.customerType.toLowerCase()}`}>{typeLabel(customer.customerType, t)}</span></div><dl className="profile-details"><div><dt><Phone size={17} />{t('customers:phone')}</dt><dd><a href={`tel:${customer.phone}`}>{customer.phone}</a></dd></div>{customer.email && <div><dt><Mail size={17} />{t('customers:email')}</dt><dd><a href={`mailto:${customer.email}`}>{customer.email}</a></dd></div>}<div><dt><CircleUserRound size={17} />{t('customers:code')}</dt><dd>{customer.customerCode}</dd></div></dl>{canStatus && <button className={`button button--wide ${customer.status === 'ACTIVE' ? 'button--danger-ghost' : 'button--secondary'}`} onClick={() => setStatusTarget(customer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}>{customer.status === 'ACTIVE' ? <PowerOff size={18} /> : <Power size={18} />}{t(customer.status === 'ACTIVE' ? 'customers:deactivate' : 'customers:reactivate')}</button>}</section>
      <section className="content-card detail-notes"><div className="section-header"><div><h2>{t('customers:notes')}</h2></div>{canEdit && <Link className="text-button" to={`/customers/${customer.id}/edit`}>{t('edit')}</Link>}</div>{customer.note ? <p className="notes-copy">{customer.note}</p> : <div className="empty-inline"><StickyNote size={22} /><span>{t('customers:notesEmpty')}</span></div>}</section>
      <section className="content-card detail-addresses"><div className="section-header"><div><h2>{t('addresses:title')}</h2><p>{customer.addresses.length ? t('addresses:count', { count: customer.addresses.length }) : t('addresses:emptyBody')}</p></div>{canAddress && <button className="button button--secondary" onClick={() => setAddressDialog({ open: true })}><Plus size={18} />{t('addresses:add')}</button>}</div>
        {customer.addresses.length === 0 ? <StatePanel compact icon={<MapPin />} title={t('addresses:emptyTitle')} body={t('addresses:emptyBody')} action={canAddress ? <button className="button button--primary" onClick={() => setAddressDialog({ open: true })}>{t('addresses:add')}</button> : undefined} /> : <div className="address-list">{customer.addresses.map((address) => <AddressCard key={address.id} address={address} canManage={canAddress} onEdit={() => setAddressDialog({ open: true, address })} onDefault={() => void setDefault(address)} onStatus={() => { setAddressStatusTarget(address); setReplacementId(undefined) }} t={t} />)}</div>}
      </section>
      <section className="metadata-card"><h2>{t('customers:metadata')}</h2><dl><div><dt><Building2 size={16} />{t('branch')}</dt><dd>{customer.branch.name}</dd></div><div><dt>{t('customers:source')}</dt><dd>{sourceLabel(customer.source, t)}</dd></div><div><dt><CalendarDays size={16} />{t('customers:created')}</dt><dd>{formatDate(customer.createdAt, i18n.language, true)}</dd></div><div><dt>{t('customers:updated')}</dt><dd>{formatDate(customer.updatedAt, i18n.language, true)}</dd></div></dl></section>
      {canAudit && <section className="content-card detail-audit"><div className="section-header"><div><h2>{t('audit:title')}</h2></div></div>{activities.isPending ? <LoadingState rows={3} /> : activities.isError ? <ErrorState title={t('errors:genericTitle')} body={t('errors:genericBody')} onRetry={() => void activities.refetch()} /> : activities.data.items.length === 0 ? <div className="empty-inline"><Activity size={22} /><span>{t('audit:empty')}</span></div> : <><div className="activity-timeline">{activities.data.items.map((item) => <ActivityItem key={item.id} item={item} language={i18n.language} t={t} />)}</div>{activities.data.totalPages > 1 && <div className="audit-pagination"><button className="button button--secondary" disabled={activityPage === 0} onClick={() => setActivityPage((page) => page - 1)}>{t('previous')}</button><span>{t('page', { current: activityPage + 1, total: activities.data.totalPages })}</span><button className="button button--secondary" disabled={activityPage + 1 >= activities.data.totalPages} onClick={() => setActivityPage((page) => page + 1)}>{t('next')}</button></div>}</>}</section>}
    </div>
    <AddressDialog open={addressDialog.open} onClose={() => setAddressDialog({ open: false })} customerId={customer.id} branchId={branchId ?? customer.branch.id} address={addressDialog.address} />
    <ConfirmDialog open={statusTarget !== null} onClose={() => setStatusTarget(null)} onConfirm={() => void changeCustomerStatus()} title={t(statusTarget === 'INACTIVE' ? 'customers:deactivateTitle' : 'customers:reactivateTitle')} body={t(statusTarget === 'INACTIVE' ? 'customers:deactivateBody' : 'customers:reactivateBody')} confirmLabel={t(statusTarget === 'INACTIVE' ? 'customers:deactivate' : 'customers:reactivate')} tone={statusTarget === 'INACTIVE' ? 'danger' : 'primary'} pending={statusMutation.isPending} />
    <ConfirmDialog open={addressStatusTarget !== null} onClose={() => { setAddressStatusTarget(null); setReplacementId(undefined) }} onConfirm={() => void changeAddressStatus()} title={t(addressStatusTarget?.status === 'ACTIVE' ? 'addresses:deactivateTitle' : 'addresses:reactivate')} body={t(addressStatusTarget?.status === 'ACTIVE' ? 'addresses:deactivateBody' : 'addresses:activeOnlyDefault')} confirmLabel={t(addressStatusTarget?.status === 'ACTIVE' ? 'addresses:deactivate' : 'addresses:reactivate')} tone={addressStatusTarget?.status === 'ACTIVE' ? 'danger' : 'primary'} pending={addressStatusMutation.isPending}>
      {addressStatusTarget?.isDefault && addressStatusTarget.status === 'ACTIVE' && activeReplacements.length > 0 && <label className="form-field dialog-field"><span className="form-field__label">{t('addresses:replacement')}</span><select value={replacementId ?? ''} onChange={(event) => setReplacementId(Number(event.target.value) || undefined)} required><option value="">{t('addresses:replacementHint')}</option>{activeReplacements.map((address) => <option key={address.id} value={address.id}>{address.receiverName} — {formatAddress(address)}</option>)}</select></label>}
    </ConfirmDialog>
  </div>
}

function AddressCard({ address, canManage, onEdit, onDefault, onStatus, t }: { address: CustomerAddress; canManage: boolean; onEdit: () => void; onDefault: () => void; onStatus: () => void; t: ReturnType<typeof useTranslation>['t'] }) {
  return <article className={`address-card${address.status === 'INACTIVE' ? ' address-card--inactive' : ''}`}><div className="address-card__header"><span className="address-icon"><MapPin size={20} /></span><div><h3>{address.receiverName}</h3><a href={`tel:${address.receiverPhone}`}>{address.receiverPhone}</a></div><div className="address-card__badges">{address.isDefault && <span className="badge badge--default"><Check size={14} />{t('addresses:default')}</span>}<span className={`badge badge--status-${address.status.toLowerCase()}`}><span className="badge__dot" />{address.status === 'ACTIVE' ? t('active') : t('inactive')}</span></div></div><p>{formatAddress(address)}</p>{address.deliveryNote && <small>{address.deliveryNote}</small>}{canManage && <details className="action-menu address-card__menu"><summary className="icon-button" aria-label={t('openMenu')}><MoreHorizontal size={19} /></summary><div className="action-menu__content"><button onClick={onEdit}><Pencil size={17} />{t('edit')}</button>{!address.isDefault && address.status === 'ACTIVE' && <button onClick={onDefault}><Check size={17} />{t('addresses:setDefault')}</button>}<button onClick={onStatus}>{address.status === 'ACTIVE' ? <PowerOff size={17} /> : <Power size={17} />}{t(address.status === 'ACTIVE' ? 'addresses:deactivate' : 'addresses:reactivate')}</button></div></details>}</article>
}

function ActivityItem({ item, language, t }: { item: CustomerActivity; language: string; t: ReturnType<typeof useTranslation>['t'] }) {
  const labels: Record<string, string> = { CUSTOMER_CREATED: 'created', CUSTOMER_UPDATED: 'updated', CUSTOMER_STATUS_CHANGED: 'statusChanged', ADDRESS_CREATED: 'addressCreated', ADDRESS_UPDATED: 'addressUpdated', ADDRESS_DEFAULT_CHANGED: 'defaultChanged', ADDRESS_STATUS_CHANGED: 'addressStatusChanged' }
  return <article className="activity-item"><span className="activity-item__dot" /><div><strong>{t(`audit:${labels[item.action] ?? 'updated'}`)}</strong><p>{t('audit:by', { name: item.actor.displayName })}</p><time dateTime={item.createdAt}>{formatDate(item.createdAt, language, true)}</time></div></article>
}
