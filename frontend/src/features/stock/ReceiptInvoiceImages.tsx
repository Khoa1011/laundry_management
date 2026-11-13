import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest, apiRequestBlob } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES as P } from '../../auth/permissionCodes.generated'
import { EvidenceCaptureField } from '../../components/EvidenceCaptureField'
import { MediaPreview } from '../../components/MediaPreview'
import { ConfirmDialog, OverlayDialog } from '../../components/OverlayDialog'
import { Button } from '../../components/ui/Button'
import { Surface } from '../../components/ui/Surface'
import { useToast } from '../../providers/ToastProvider'
import { invoiceEndpoint, uploadInvoiceImage, useInvoiceError, useReceiptInvoicePermissions, type ImageMetadata, type Listing, type PendingInvoiceImage } from './receiptInvoiceApi'

export function InvoiceCapture({ value, onChange, disabled }: {
  value: File | null; onChange: (file: File | null) => void; disabled?: boolean
}) {
  const { t } = useTranslation('stock')
  return <EvidenceCaptureField value={value} onChange={onChange} disabled={disabled} allowWebp labels={{
    label: t('invoice.title'), takePhoto: t('invoice.camera'), chooseFile: t('invoice.choose'),
    replaceFile: t('invoice.replace'), removeFile: t('invoice.remove'), preview: t('invoice.preview'),
    emptyHint: t('invoice.optional'), invalidType: t('invoice.invalid'),
    imageTooLarge: t('invoice.tooLarge'), pdfTooLarge: t('invoice.invalid'),
  }} />
}

export function ReceiptInvoiceImages({ documentId, branchId, cancelled, manage = true }: {
  documentId: number; branchId: number; cancelled: boolean; manage?: boolean
}) {
  const { t } = useTranslation('stock')
  const permission = useReceiptInvoicePermissions()
  const client = useQueryClient()
  const { notify } = useToast()
  const message = useInvoiceError()
  const [choice, setChoice] = useState<PendingInvoiceImage | null>(null)
  const [replaces, setReplaces] = useState<ImageMetadata | null>(null)
  const [remove, setRemove] = useState<ImageMetadata | null>(null)
  const [preview, setPreview] = useState<ImageMetadata | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const { hasPermission } = useAuth()
  const canReadHistory = permission.read && hasPermission(P.INVENTORY_AUDIT_READ)
  const key = ['receipt-invoices', branchId, documentId]
  const listing = useQuery({
    queryKey: key, enabled: permission.read, retry: false, gcTime: 0,
    queryFn: ({ signal }) => apiRequest<Listing>(invoiceEndpoint(documentId, branchId), { branchId, signal }),
  })
  const history = useQuery({
    queryKey: [...key, 'history'], enabled: canReadHistory && showHistory, retry: false, gcTime: 0,
    queryFn: ({ signal }) => apiRequest<Listing>(invoiceEndpoint(documentId, branchId) + '&history=true', { branchId, signal }),
  })
  const previewFile = useQuery({
    queryKey: [...key, 'content', preview?.id], enabled: Boolean(permission.read && preview), retry: false, gcTime: 0,
    queryFn: ({ signal }) => apiRequestBlob(invoiceEndpoint(documentId, branchId, `/${preview!.id}/content`), { branchId, signal }),
  })
  const [imageUrl, setImageUrl] = useState('')
  useEffect(() => {
    if (!previewFile.data) { setImageUrl(''); return }
    const url = URL.createObjectURL(previewFile.data)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [previewFile.data])

  const save = useMutation({
    mutationFn: () => uploadInvoiceImage(documentId, branchId, choice!, replaces?.id),
    onSuccess: () => {
      setChoice(null)
      setReplaces(null)
      void client.invalidateQueries({ queryKey: key })
      notify(t('invoice.uploaded'))
    },
  })
  const deletion = useMutation({
    mutationFn: (id: string) => apiRequest<void>(invoiceEndpoint(documentId, branchId, `/${id}`), { method: 'DELETE', branchId }),
    onSuccess: () => {
      setRemove(null)
      void client.invalidateQueries({ queryKey: key })
      notify(t('invoice.removed'))
    },
  })
  const busy = save.isPending || deletion.isPending
  const canUpload = manage && !cancelled && permission.upload && (!permission.read || listing.data?.storageReady === true)
  if (!permission.read && !canUpload) return null

  return <Surface as="section" className="operations-catalog operations-form" aria-label={t('invoice.title')}>
    <h2>{t('invoice.title')}</h2>
    {permission.read && listing.isPending && <p role="status">{t('invoice.loading')}</p>}
    {listing.isError && <><p role="alert">{message(listing.error)}</p>
      <Button type="button" variant="secondary" onClick={() => void listing.refetch()}>{t('retry')}</Button></>}
    {listing.data && !listing.data.files.length && <p>{t('invoice.empty')}</p>}
    {listing.data?.storageReady === false && <p role="status">{t('invoice.unconfigured')}</p>}
    {permission.read && listing.data?.files.map((file) => <div key={file.id} className="operations-record">
      <p><strong>{file.originalName}</strong> · {t('revision')} {file.version}</p>
      <div className="stock-header-actions">
        <Button type="button" variant="secondary" onClick={() => setPreview(file)}>{t('invoice.preview')}</Button>
        {canUpload && <Button type="button" variant="secondary" disabled={busy} onClick={() => {
          save.reset()
          setChoice(null)
          setReplaces(file)
        }}>{t('invoice.replace')}</Button>}
        {manage && !cancelled && permission.remove && <Button type="button" variant="danger" disabled={busy} onClick={() => {
          deletion.reset()
          setRemove(file)
        }}>{t('invoice.remove')}</Button>}
      </div>
    </div>)}
    {manage && canReadHistory && <div>
      <Button type="button" variant="secondary" aria-expanded={showHistory}
        onClick={() => setShowHistory((visible) => !visible)}>{t('invoice.history')}</Button>
      {showHistory && <>
        {history.isPending && <p role="status">{t('invoice.loading')}</p>}
        {history.isError && <><p role="alert">{message(history.error)}</p>
          <Button type="button" variant="secondary" onClick={() => void history.refetch()}>{t('retry')}</Button></>}
        {history.data && !history.data.files.length && <p>{t('invoice.emptyHistory')}</p>}
        {history.data?.files.map((file) => <div key={file.id} className="operations-record">
          <p><strong>{file.originalName}</strong> · {t('revision')} {file.version} ·
            {' '}{t(file.status === 'REPLACED' ? 'invoice.replaced' : 'invoice.removed')}</p>
          <Button type="button" variant="secondary" onClick={() => setPreview(file)}>{t('invoice.preview')}</Button>
        </div>)}
      </>}
    </div>}
    {canUpload && <>
      {replaces && <p>{t('invoice.replacing', { name: replaces.originalName })}</p>}
      <InvoiceCapture value={choice?.file ?? null} disabled={busy} onChange={(file) => {
        save.reset()
        setChoice(file ? { file, command: crypto.randomUUID() } : null)
      }} />
      {(choice || replaces) && <div className="stock-header-actions">
        {choice && <Button type="button" loading={save.isPending} disabled={busy} onClick={() => save.mutate()}>
          {t(save.isError ? 'retry' : 'invoice.upload')}
        </Button>}
        {replaces && <Button type="button" variant="secondary" disabled={busy} onClick={() => {
          save.reset()
          setChoice(null)
          setReplaces(null)
        }}>{t('close')}</Button>}
      </div>}
      {save.isError && <p role="alert">{message(save.error)}</p>}
    </>}
    <ConfirmDialog open={!!remove} title={t('invoice.remove')} body={t('invoice.removeBody')}
      pending={deletion.isPending} confirmLabel={t('invoice.remove')} tone="danger"
      onClose={() => setRemove(null)} onConfirm={() => { if (remove) deletion.mutate(remove.id) }}>
      {deletion.isError && <p role="alert">{message(deletion.error)}</p>}
    </ConfirmDialog>
    <OverlayDialog open={permission.read && !!preview && (preview.status === 'ACTIVE' || canReadHistory)}
      title={preview?.originalName ?? t('invoice.preview')} onClose={() => setPreview(null)}>
      {previewFile.isPending && <p role="status">{t('invoice.loading')}</p>}
      {previewFile.isError && <><p role="alert">{message(previewFile.error)}</p>
        <Button type="button" variant="secondary" onClick={() => void previewFile.refetch()}>{t('retry')}</Button></>}
      {preview && imageUrl && <div className="media-preview">
        <MediaPreview source={imageUrl} contentType={preview.contentType} name={preview.originalName} />
      </div>}
    </OverlayDialog>
  </Surface>
}
