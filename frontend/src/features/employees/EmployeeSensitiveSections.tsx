import {
  BadgeDollarSign, CheckCircle2, Download, Eye, EyeOff, FileImage, FileText, FolderLock,
  History, IdCard, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, Upload, XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { EvidenceCaptureField } from '../../components/EvidenceCaptureField'
import { MediaPreview } from '../../components/MediaPreview'
import { MoneyInput } from '../../components/MoneyInput'
import { ConfirmDialog, OverlayDialog } from '../../components/OverlayDialog'
import { ErrorState, LoadingState, StatePanel } from '../../components/States'
import { CollapsibleFilterPanel } from '../../components/ui/CollapsibleFilterPanel'
import { StatCard } from '../../components/ui/StatCard'
import { useToast } from '../../providers/ToastProvider'
import { moneyInputToNumber } from '../../utils/money'
import {
  loadEmployeeDocument, useDeleteEmployeeDocument, useEmployeeCompensation,
  useEmployeeCompensationHistory, useEmployeeDocuments, useEmployeeIdentity,
  useReplaceEmployeeDocument, useUpdateEmployeeCompensation, useUploadEmployeeDocument,
  useUpsertEmployeeIdentity, useVerifyEmployeeIdentity,
} from './sensitiveApi'
import type {
  Compensation, EmployeeDocument, EmployeeDocumentStatus, EmployeeDocumentType,
  EmployeeIdentity, IdentityVerificationStatus,
} from './sensitiveTypes'

type SensitiveTab = 'compensation' | 'identity' | 'documents'

export function EmployeeSensitiveSections({ employeeId }: { employeeId: number }) {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const tabs = useMemo(() => {
    const result: Array<{ id: SensitiveTab; label: string; icon: ReactNode }> = []
    if ([PERMISSION_CODES.EMPLOYEE_COMPENSATION_READ, PERMISSION_CODES.EMPLOYEE_COMPENSATION_UPDATE,
      PERMISSION_CODES.EMPLOYEE_COMPENSATION_HISTORY_READ].some(hasPermission)) {
      result.push({ id: 'compensation', label: t('employee:sensitive.compensation'), icon: <BadgeDollarSign size={17} /> })
    }
    if ([PERMISSION_CODES.EMPLOYEE_IDENTITY_MASKED_READ, PERMISSION_CODES.EMPLOYEE_IDENTITY_READ,
      PERMISSION_CODES.EMPLOYEE_IDENTITY_UPDATE].some(hasPermission)) {
      result.push({ id: 'identity', label: t('employee:sensitive.identity'), icon: <IdCard size={17} /> })
    }
    if ([PERMISSION_CODES.EMPLOYEE_FILE_READ, PERMISSION_CODES.EMPLOYEE_FILE_UPLOAD,
      PERMISSION_CODES.EMPLOYEE_FILE_REPLACE, PERMISSION_CODES.EMPLOYEE_FILE_DELETE,
      PERMISSION_CODES.EMPLOYEE_FILE_DOWNLOAD].some(hasPermission)) {
      result.push({ id: 'documents', label: t('employee:sensitive.documents'), icon: <FolderLock size={17} /> })
    }
    return result
  }, [hasPermission, t])
  const [tab, setTab] = useState<SensitiveTab>(tabs[0]?.id ?? 'compensation')
  useEffect(() => { if (!tabs.some((item) => item.id === tab) && tabs[0]) setTab(tabs[0].id) }, [tab, tabs])
  if (!tabs.length) return null

  return <section className="employee-sensitive" aria-labelledby="employee-sensitive-title">
    <header className="employee-sensitive__header">
      <span className="employee-sensitive__icon"><ShieldCheck size={20} /></span>
      <div><h2 id="employee-sensitive-title">{t('employee:sensitive.title')}</h2><p>{t('employee:sensitive.subtitle')}</p></div>
    </header>
    <div className="employee-sensitive__tabs" role="tablist" aria-label={t('employee:sensitive.title')}>
      {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id}
        className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.icon}{item.label}</button>)}
    </div>
    <div className="employee-sensitive__panel" role="tabpanel">
      {tab === 'compensation' && <CompensationPanel employeeId={employeeId} />}
      {tab === 'identity' && <IdentityPanel employeeId={employeeId} />}
      {tab === 'documents' && <DocumentsPanel employeeId={employeeId} />}
    </div>
  </section>
}

function CompensationPanel({ employeeId }: { employeeId: number }) {
  const { t, i18n } = useTranslation(); const { hasPermission } = useAuth()
  const canRead = hasPermission(PERMISSION_CODES.EMPLOYEE_COMPENSATION_READ)
  const canHistory = hasPermission(PERMISSION_CODES.EMPLOYEE_COMPENSATION_HISTORY_READ)
  const canUpdate = hasPermission(PERMISSION_CODES.EMPLOYEE_COMPENSATION_UPDATE)
  const current = useEmployeeCompensation(employeeId, canRead)
  const history = useEmployeeCompensationHistory(employeeId, canHistory)
  const [open, setOpen] = useState(false)
  return <div className="sensitive-stack">
    <div className="sensitive-panel-heading"><div><h3>{t('employee:sensitive.compensation')}</h3><p>{t('employee:sensitive.compensationHint')}</p></div>
      {canUpdate && <button type="button" className="button button--primary" onClick={() => setOpen(true)}><Plus size={17} />{t('employee:sensitive.updateCompensation')}</button>}</div>
    {canRead && (current.isPending ? <LoadingState rows={2} /> : current.isError ? <ErrorState title={t('employee:sensitive.loadError')} body={t('employee:sensitive.retryBody')} onRetry={() => void current.refetch()} />
      : <div className="compensation-summary">
        <CompensationItem label={t('employee:sensitive.currentCompensation')} value={current.data?.current} language={i18n.language} />
        <CompensationItem label={t('employee:sensitive.scheduledCompensation')} value={current.data?.scheduled} language={i18n.language} />
      </div>)}
    {canHistory && <div className="sensitive-subsection"><h4><History size={17} />{t('employee:sensitive.compensationHistory')}</h4>
      {history.isPending ? <LoadingState rows={3} /> : history.isError ? <ErrorState title={t('employee:sensitive.loadError')} body={t('employee:sensitive.retryBody')} onRetry={() => void history.refetch()} />
        : history.data?.items.length ? <div className="sensitive-history">{history.data.items.map((item) => <CompensationHistoryRow key={item.id} item={item} language={i18n.language} />)}</div>
          : <p className="employee-empty-copy">{t('employee:sensitive.noCompensation')}</p>}</div>}
    <CompensationDialog employeeId={employeeId} open={open} onClose={() => setOpen(false)} />
  </div>
}

function CompensationItem({ label, value, language }: { label: string; value?: Compensation | null; language: string }) {
  const { t } = useTranslation()
  return <StatCard
    className="compensation-stat-card"
    icon={<BadgeDollarSign />}
    label={label}
    value={value ? formatMoney(value.baseSalary, value.currency, language) : '—'}
    tone={value?.status === 'SCHEDULED' ? 'warning' : value ? 'operational' : 'neutral'}
    supporting={value
      ? <><div className="compensation-stat-card__meta"><StatusTag status={value.status} /><small>{formatDate(value.effectiveFrom, language)}</small></div><p>{value.reason}</p></>
      : <p className="muted">{t('employee:sensitive.noCompensation')}</p>}
  />
}
function CompensationHistoryRow({ item, language }: { item: Compensation; language: string }) {
  return <div className="sensitive-history__row"><div><strong>{formatMoney(item.baseSalary, item.currency, language)}</strong><small>{formatDate(item.effectiveFrom, language)}{item.effectiveTo ? ` - ${formatDate(item.effectiveTo, language)}` : ''}</small></div><StatusTag status={item.status} /><p>{item.reason}</p></div>
}
function CompensationDialog({ employeeId, open, onClose }: { employeeId: number; open: boolean; onClose: () => void }) {
  const { t } = useTranslation(); const { notify } = useToast(); const mutation = useUpdateEmployeeCompensation(employeeId)
  const [salary, setSalary] = useState(''); const [currency, setCurrency] = useState('VND')
  const [date, setDate] = useState(''); const [reason, setReason] = useState('')
  useEffect(() => { if (open) { setSalary(''); setCurrency('VND'); setDate(new Date().toISOString().slice(0, 10)); setReason('') } }, [open])
  const valid = moneyInputToNumber(salary) >= 0 && salary.trim() !== '' && date && reason.trim()
  const submit = async () => { if (!valid) return; try { await mutation.mutateAsync({ baseSalary: moneyInputToNumber(salary), currency, effectiveFrom: date, reason: reason.trim() }); notify(t('employee:sensitive.compensationSaved')); onClose() } catch (error) { notify(errorMessage(error, t('employee:sensitive.saveError')), 'error') } }
  return <OverlayDialog open={open} onClose={onClose} title={t('employee:sensitive.updateCompensation')} description={t('employee:sensitive.compensationDialogHint')} footer={<><button className="button button--secondary" onClick={onClose}>{t('cancel')}</button><button className="button button--primary" disabled={!valid || mutation.isPending} onClick={() => void submit()}>{mutation.isPending ? t('saving') : t('confirm')}</button></>}>
    <div className="form-stack"><MoneyInput value={salary} onValueChange={setSalary} label={t('employee:sensitive.baseSalary')} currency={currency} required maxIntegerDigits={15} fractionDigits={currency === 'USD' ? 2 : 0} />
      <label className="field"><span>{t('employee:sensitive.currency')} *</span><select value={currency} onChange={(event) => { const next = event.target.value; setCurrency(next); if (next === 'VND') setSalary((value) => value.split('.')[0] ?? '') }}><option value="VND">VND</option><option value="USD">USD</option></select></label>
      <label className="field"><span>{t('employee:sensitive.effectiveFrom')} *</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label className="field"><span>{t('employee:sensitive.reason')} *</span><textarea rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label></div>
  </OverlayDialog>
}

function IdentityPanel({ employeeId }: { employeeId: number }) {
  const { t, i18n } = useTranslation(); const { hasPermission } = useAuth(); const { notify } = useToast()
  const canMasked = hasPermission(PERMISSION_CODES.EMPLOYEE_IDENTITY_MASKED_READ)
  const canFull = hasPermission(PERMISSION_CODES.EMPLOYEE_IDENTITY_READ)
  const canUpdate = hasPermission(PERMISSION_CODES.EMPLOYEE_IDENTITY_UPDATE)
  const [reveal, setReveal] = useState(false); const [editOpen, setEditOpen] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<IdentityVerificationStatus | null>(null)
  const query = useEmployeeIdentity(employeeId, reveal, canMasked || canFull)
  const verify = useVerifyEmployeeIdentity(employeeId)
  const missing = query.error instanceof ApiError && query.error.status === 404
  const identity = query.data
  const verifyNow = async (reason?: string) => { if (!identity || !verifyStatus) return; try { await verify.mutateAsync({ type: identity.identityType, status: verifyStatus, reason, version: identity.version }); notify(t('employee:sensitive.identityVerified')); setVerifyStatus(null) } catch (error) { notify(errorMessage(error, t('employee:sensitive.saveError')), 'error') } }
  return <div className="sensitive-stack"><div className="sensitive-panel-heading"><div><h3>{t('employee:sensitive.identity')}</h3><p>{t('employee:sensitive.identityHint')}</p></div>{canUpdate && <button className={`button ${identity ? 'button--primary' : 'button--create'}`} onClick={() => setEditOpen(true)}>{identity ? <Pencil size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}{identity ? t('employee:sensitive.editIdentity') : t('employee:sensitive.addIdentity')}</button>}</div>
    {query.isPending ? <LoadingState rows={3} /> : query.isError && !missing ? <ErrorState title={t('employee:sensitive.loadError')} body={t('employee:sensitive.retryBody')} onRetry={() => void query.refetch()} />
      : !identity ? <StatePanel compact title={t('employee:sensitive.noIdentity')} body={t('employee:sensitive.noIdentityBody')} />
        : <div className="identity-detail"><div className="identity-number"><span>{t('employee:sensitive.citizenId')}</span><strong>{identity.number}</strong>{canFull && <button type="button" className="icon-button" title={reveal ? t('employee:sensitive.hideNumber') : t('employee:sensitive.revealNumber')} aria-label={reveal ? t('employee:sensitive.hideNumber') : t('employee:sensitive.revealNumber')} onClick={() => setReveal((value) => !value)}>{reveal ? <EyeOff size={18} /> : <Eye size={18} />}</button>}</div>
          <dl className="identity-facts"><div><dt>{t('employee:sensitive.issuedDate')}</dt><dd>{identity.issuedDate ? formatDate(identity.issuedDate, i18n.language) : t('notAvailable')}</dd></div><div><dt>{t('employee:sensitive.issuedPlace')}</dt><dd>{identity.issuedPlace || t('notAvailable')}</dd></div><div><dt>{t('employee:sensitive.expiresOn')}</dt><dd>{identity.expiresOn ? formatDate(identity.expiresOn, i18n.language) : t('notAvailable')}</dd></div><div><dt>{t('status')}</dt><dd><VerificationTag status={identity.verificationStatus} /></dd></div></dl>
          {identity.verificationReason && <p className="identity-reason">{identity.verificationReason}</p>}
          {canUpdate && <div className="identity-actions"><button className="button button--secondary" onClick={() => setVerifyStatus('VERIFIED')}><CheckCircle2 size={17} />{t('employee:sensitive.verify')}</button><button className="button button--secondary button--danger-text" onClick={() => setVerifyStatus('REJECTED')}><XCircle size={17} />{t('employee:sensitive.reject')}</button></div>}
        </div>}
    <IdentityDialog employeeId={employeeId} identity={identity} open={editOpen} onClose={() => setEditOpen(false)} />
    <VerificationDialog status={verifyStatus} open={verifyStatus !== null} onClose={() => setVerifyStatus(null)} onConfirm={verifyNow} pending={verify.isPending} />
  </div>
}

function IdentityDialog({ employeeId, identity, open, onClose }: { employeeId: number; identity?: EmployeeIdentity; open: boolean; onClose: () => void }) {
  const { t } = useTranslation(); const { notify } = useToast(); const mutation = useUpsertEmployeeIdentity(employeeId)
  const [number, setNumber] = useState(''); const [issuedDate, setIssuedDate] = useState(''); const [issuedPlace, setIssuedPlace] = useState(''); const [expiresOn, setExpiresOn] = useState('')
  useEffect(() => { if (open) { setNumber(''); setIssuedDate(identity?.issuedDate ?? ''); setIssuedPlace(identity?.issuedPlace ?? ''); setExpiresOn(identity?.expiresOn ?? '') } }, [identity, open])
  const valid = /^\d{12}$/.test(number.replace(/\s/g, ''))
  const submit = async () => { if (!valid) return; try { await mutation.mutateAsync({ identityType: 'CITIZEN_ID', number, issuedDate: issuedDate || undefined, issuedPlace: issuedPlace.trim() || undefined, expiresOn: expiresOn || undefined, version: identity?.version }); notify(t('employee:sensitive.identitySaved')); onClose() } catch (error) { notify(errorMessage(error, t('employee:sensitive.saveError')), 'error') } }
  return <OverlayDialog open={open} onClose={onClose} title={identity ? t('employee:sensitive.editIdentity') : t('employee:sensitive.addIdentity')} description={t('employee:sensitive.identityDialogHint')} footer={<><button className="button button--secondary" onClick={onClose}>{t('cancel')}</button><button className="button button--primary" disabled={!valid || mutation.isPending} onClick={() => void submit()}>{mutation.isPending ? t('saving') : t('confirm')}</button></>}>
    <div className="form-stack"><label className="field"><span>{t('employee:sensitive.citizenId')} *</span><input inputMode="numeric" autoComplete="off" maxLength={12} value={number} onChange={(event) => setNumber(event.target.value.replace(/\D/g, ''))} /><small>{t('employee:sensitive.reenterIdentity')}</small></label><label className="field"><span>{t('employee:sensitive.issuedDate')}</span><input type="date" value={issuedDate} onChange={(event) => setIssuedDate(event.target.value)} /></label><label className="field"><span>{t('employee:sensitive.issuedPlace')}</span><input maxLength={255} value={issuedPlace} onChange={(event) => setIssuedPlace(event.target.value)} /></label><label className="field"><span>{t('employee:sensitive.expiresOn')}</span><input type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} /></label></div>
  </OverlayDialog>
}

function VerificationDialog({ status, open, onClose, onConfirm, pending }: { status: IdentityVerificationStatus | null; open: boolean; onClose: () => void; onConfirm: (reason?: string) => Promise<void>; pending: boolean }) {
  const { t } = useTranslation(); const [reason, setReason] = useState('')
  useEffect(() => { if (open) setReason('') }, [open])
  const rejected = status === 'REJECTED'
  return <OverlayDialog open={open} onClose={onClose} title={rejected ? t('employee:sensitive.rejectIdentity') : t('employee:sensitive.verifyIdentity')} footer={<><button className="button button--secondary" onClick={onClose}>{t('cancel')}</button><button className={`button ${rejected ? 'button--danger' : 'button--primary'}`} disabled={pending || (rejected && !reason.trim())} onClick={() => void onConfirm(reason.trim() || undefined)}>{pending ? t('saving') : t('confirm')}</button></>}>
    <div className="form-stack"><p className="dialog-copy">{rejected ? t('employee:sensitive.rejectIdentityHint') : t('employee:sensitive.verifyIdentityHint')}</p>{rejected && <label className="field"><span>{t('employee:sensitive.reason')} *</span><textarea rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>}</div>
  </OverlayDialog>
}

function DocumentsPanel({ employeeId }: { employeeId: number }) {
  const { t, i18n } = useTranslation(); const { hasPermission } = useAuth(); const { notify } = useToast()
  const canRead = hasPermission(PERMISSION_CODES.EMPLOYEE_FILE_READ); const canUpload = hasPermission(PERMISSION_CODES.EMPLOYEE_FILE_UPLOAD)
  const canReplace = hasPermission(PERMISSION_CODES.EMPLOYEE_FILE_REPLACE); const canDelete = hasPermission(PERMISSION_CODES.EMPLOYEE_FILE_DELETE); const canDownload = hasPermission(PERMISSION_CODES.EMPLOYEE_FILE_DOWNLOAD)
  const [status, setStatus] = useState<EmployeeDocumentStatus>('ACTIVE'); const query = useEmployeeDocuments(employeeId, status, canRead)
  const [uploadOpen, setUploadOpen] = useState(false); const [replace, setReplace] = useState<EmployeeDocument | null>(null); const [deleting, setDeleting] = useState<EmployeeDocument | null>(null); const [deleteReason, setDeleteReason] = useState('')
  const [preview, setPreview] = useState<{ url: string; type: string; name: string } | null>(null); const [openingId, setOpeningId] = useState<number | null>(null)
  const remove = useDeleteEmployeeDocument(employeeId)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])
  const openFile = async (document: EmployeeDocument) => { setOpeningId(document.id); try { const blob = await loadEmployeeDocument(employeeId, document.id); const url = URL.createObjectURL(blob); setPreview({ url, type: document.contentType, name: document.originalFilename }) } catch (error) { notify(errorMessage(error, t('employee:sensitive.openError')), 'error') } finally { setOpeningId(null) } }
  const download = async (document: EmployeeDocument) => { try { const blob = await loadEmployeeDocument(employeeId, document.id, true); const url = URL.createObjectURL(blob); const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = document.originalFilename; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) } catch (error) { notify(errorMessage(error, t('employee:sensitive.openError')), 'error') } }
  const deleteNow = async () => { if (!deleting || !deleteReason.trim()) return; try { await remove.mutateAsync({ documentId: deleting.id, reason: deleteReason.trim(), recordVersion: deleting.recordVersion }); notify(t('employee:sensitive.documentDeleted')); setDeleting(null); setDeleteReason('') } catch (error) { notify(errorMessage(error, t('employee:sensitive.saveError')), 'error') } }
  return <div className="sensitive-stack"><div className="sensitive-panel-heading"><div><h3>{t('employee:sensitive.documents')}</h3><p>{t('employee:sensitive.documentsHint')}</p></div>{canUpload && <button className="button button--primary" onClick={() => setUploadOpen(true)}><Upload size={17} />{t('employee:sensitive.uploadDocument')}</button>}</div>
    {canRead && <><CollapsibleFilterPanel className="document-filter-collapse" label={t('employee:filters')} activeCount={status === 'ACTIVE' ? 0 : 1}><label className="document-status-filter"><span>{t('status')}</span><select value={status} onChange={(event) => setStatus(event.target.value as EmployeeDocumentStatus)}><option value="ACTIVE">{t('employee:sensitive.activeFiles')}</option><option value="REPLACED">{t('employee:sensitive.replacedFiles')}</option><option value="DELETED">{t('employee:sensitive.deletedFiles')}</option></select></label></CollapsibleFilterPanel>
      {query.isPending ? <LoadingState rows={4} /> : query.isError ? <ErrorState title={t('employee:sensitive.loadError')} body={t('employee:sensitive.retryBody')} onRetry={() => void query.refetch()} /> : query.data?.items.length ? <div className="document-list">{query.data.items.map((document) => <article className="document-row" key={document.id}>
        <DocumentVisual employeeId={employeeId} document={document} canPreview={canDownload} onOpen={() => void openFile(document)} />
        <div className="document-row__main"><strong>{document.originalFilename}</strong><small>{documentTypeLabel(document.documentType, t)} · {formatBytes(document.sizeBytes)} · v{document.documentVersion}</small><small>{formatDateTime(document.createdAt, i18n.language)} · {document.actor.displayName}</small>{document.description && <p>{document.description}</p>}</div><StatusTag status={document.status} /><div className="document-row__actions">{canDownload && <><button className="icon-button" aria-label={t('employee:sensitive.preview')} title={t('employee:sensitive.preview')} disabled={openingId === document.id} onClick={() => void openFile(document)}>{openingId === document.id ? <RefreshCw className="spin" size={18} /> : <Eye size={18} />}</button><button className="icon-button" aria-label={t('employee:sensitive.download')} title={t('employee:sensitive.download')} onClick={() => void download(document)}><Download size={18} /></button></>}{canReplace && document.status === 'ACTIVE' && <button className="icon-button" aria-label={t('employee:sensitive.replace')} title={t('employee:sensitive.replace')} onClick={() => setReplace(document)}><RefreshCw size={18} /></button>}{canDelete && document.status !== 'DELETED' && <button className="icon-button icon-button--danger" aria-label={t('delete')} title={t('delete')} onClick={() => setDeleting(document)}><Trash2 size={18} /></button>}</div></article>)}</div> : <StatePanel compact title={t('employee:sensitive.noDocuments')} body={t('employee:sensitive.noDocumentsBody')} />}</>}
    <DocumentUploadDialog employeeId={employeeId} open={uploadOpen || replace !== null} replace={replace} onClose={() => { setUploadOpen(false); setReplace(null) }} />
    <ConfirmDialog open={deleting !== null} onClose={() => { setDeleting(null); setDeleteReason('') }} onConfirm={() => void deleteNow()} title={t('employee:sensitive.deleteDocument')} body={t('employee:sensitive.deleteDocumentHint')} confirmLabel={t('delete')} pending={remove.isPending} tone="danger"><label className="field"><span>{t('employee:sensitive.reason')} *</span><textarea rows={3} maxLength={500} value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} /></label></ConfirmDialog>
    <OverlayDialog open={preview !== null} onClose={() => { if (preview) URL.revokeObjectURL(preview.url); setPreview(null) }} title={preview?.name ?? t('employee:sensitive.preview')} variant="dialog">{preview && <div className="media-preview"><MediaPreview source={preview.url} contentType={preview.type} name={preview.name} /></div>}</OverlayDialog>
  </div>
}

function DocumentVisual({ employeeId, document, canPreview, onOpen }: { employeeId: number; document: EmployeeDocument; canPreview: boolean; onOpen: () => void }) {
  const { t } = useTranslation()
  const target = useRef<HTMLButtonElement>(null)
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isImage = document.contentType === 'image/jpeg' || document.contentType === 'image/png'
  useEffect(() => {
    if (!isImage || !canPreview) return
    let active = true
    let objectUrl: string | null = null
    const load = async () => {
      setLoading(true)
      try {
        const blob = await loadEmployeeDocument(employeeId, document.id)
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setThumbnail(objectUrl)
      } catch { /* The explicit preview action remains available for retry and error feedback. */ }
      finally { if (active) setLoading(false) }
    }
    if (typeof IntersectionObserver === 'undefined') void load()
    else {
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        void load()
      }, { rootMargin: '120px' })
      if (target.current) observer.observe(target.current)
      return () => { active = false; observer.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
    }
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [canPreview, document.id, employeeId, isImage])

  if (!isImage || !canPreview) return <span className="document-row__visual document-row__visual--icon">{document.contentType === 'application/pdf' ? <FileText size={22} /> : <FileImage size={22} />}</span>
  return <button ref={target} type="button" className="document-row__visual document-row__thumbnail" onClick={onOpen}
    aria-label={`${t('employee:sensitive.preview')}: ${document.originalFilename}`} title={t('employee:sensitive.preview')}>
    {thumbnail ? <img src={thumbnail} alt="" /> : loading ? <RefreshCw className="spin" size={20} /> : <FileImage size={22} />}
  </button>
}

function DocumentUploadDialog({ employeeId, open, replace, onClose }: { employeeId: number; open: boolean; replace: EmployeeDocument | null; onClose: () => void }) {
  const { t } = useTranslation(); const { notify } = useToast(); const upload = useUploadEmployeeDocument(employeeId); const replaceMutation = useReplaceEmployeeDocument(employeeId)
  const [file, setFile] = useState<File | null>(null); const [type, setType] = useState<EmployeeDocumentType>('CONTRACT'); const [description, setDescription] = useState('')
  useEffect(() => { if (open) { setFile(null); setType(replace?.documentType ?? 'CONTRACT'); setDescription(replace?.description ?? '') } }, [open, replace])
  const pending = upload.isPending || replaceMutation.isPending
  const submit = async () => { if (!file) return; try { if (replace) await replaceMutation.mutateAsync({ documentId: replace.id, file, description }); else await upload.mutateAsync({ file, type, description }); notify(t('employee:sensitive.documentSaved')); onClose() } catch (error) { notify(errorMessage(error, t('employee:sensitive.saveError')), 'error') } }
  return <OverlayDialog open={open} onClose={onClose} title={replace ? t('employee:sensitive.replaceDocument') : t('employee:sensitive.uploadDocument')} description={t('employee:sensitive.fileRules')} footer={<><button className="button button--secondary" onClick={onClose}>{t('cancel')}</button><button className="button button--primary" disabled={!file || pending} onClick={() => void submit()}>{pending ? t('employee:sensitive.uploading') : t('confirm')}</button></>}>
    <div className="form-stack">{!replace && <label className="field"><span>{t('employee:sensitive.documentType')} *</span><select value={type} onChange={(event) => setType(event.target.value as EmployeeDocumentType)}><option value="CONTRACT">{t('employee:sensitive.types.CONTRACT')}</option><option value="IDENTITY_COPY">{t('employee:sensitive.types.IDENTITY_COPY')}</option><option value="CERTIFICATE">{t('employee:sensitive.types.CERTIFICATE')}</option><option value="OTHER">{t('employee:sensitive.types.OTHER')}</option></select></label>}<EvidenceCaptureField value={file} onChange={setFile} allowPdf required labels={{
      label: t('employee:sensitive.selectEvidence'), takePhoto: t('employee:sensitive.takePhoto'), chooseFile: t('employee:sensitive.chooseFile'), replaceFile: t('employee:sensitive.replaceSelectedFile'), removeFile: t('employee:sensitive.removeSelectedFile'), preview: t('employee:sensitive.preview'), emptyHint: t('employee:sensitive.fileRules'), invalidType: t('employee:sensitive.invalidFileType'), imageTooLarge: t('employee:sensitive.imageTooLarge'), pdfTooLarge: t('employee:sensitive.pdfTooLarge'),
    }} /><label className="field"><span>{t('employee:sensitive.description')}</span><textarea rows={3} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} /></label></div>
  </OverlayDialog>
}

function StatusTag({ status }: { status: string }) { const { t } = useTranslation(); return <span className={`sensitive-status sensitive-status--${status.toLowerCase()}`}>{t(`employee:sensitive.statuses.${status}`, { defaultValue: status })}</span> }
function VerificationTag({ status }: { status: IdentityVerificationStatus }) { const Icon = status === 'VERIFIED' ? CheckCircle2 : status === 'REJECTED' ? XCircle : ShieldCheck; return <span className={`sensitive-status sensitive-status--${status.toLowerCase()}`}><Icon size={14} /><StatusText status={status} /></span> }
function StatusText({ status }: { status: string }) { const { t } = useTranslation(); return <>{t(`employee:sensitive.statuses.${status}`, { defaultValue: status })}</> }
function documentTypeLabel(type: EmployeeDocumentType, t: (key: string) => string) { return t(`employee:sensitive.types.${type}`) }
function formatMoney(value: number, currency: string, language: string) { return new Intl.NumberFormat(language.startsWith('en') ? 'en-US' : 'vi-VN', { style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2 }).format(value) }
function formatDate(value: string, language: string) { return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-GB' : 'vi-VN').format(new Date(`${value}T00:00:00`)) }
function formatDateTime(value: string, language: string) { return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-GB' : 'vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function formatBytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1024 / 1024).toFixed(1)} MB` }
function errorMessage(error: unknown, fallback: string) { return error instanceof ApiError ? (error.problem.detail ?? error.problem.title ?? fallback) : fallback }
