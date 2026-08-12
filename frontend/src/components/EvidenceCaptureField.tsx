import { Camera, Eye, FileImage, FileText, Images, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { OverlayDialog } from './OverlayDialog'
import { MediaPreview } from './MediaPreview'

export interface EvidenceCaptureLabels {
  label: string
  takePhoto: string
  chooseFile: string
  replaceFile: string
  removeFile: string
  preview: string
  emptyHint: string
  invalidType: string
  imageTooLarge: string
  pdfTooLarge: string
}

export interface EvidenceCaptureFieldProps {
  value: File | null
  onChange: (file: File | null) => void
  labels: EvidenceCaptureLabels
  allowPdf?: boolean
  disabled?: boolean
  required?: boolean
  maxImageBytes?: number
  maxPdfBytes?: number
  cameraFacingMode?: 'user' | 'environment'
}

export function EvidenceCaptureField({
  value,
  onChange,
  labels,
  allowPdf = false,
  disabled = false,
  required = false,
  maxImageBytes = 10 * 1024 * 1024,
  maxPdfBytes = 20 * 1024 * 1024,
  cameraFacingMode = 'environment',
}: EvidenceCaptureFieldProps) {
  const id = useId()
  const cameraInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const contentType = mediaContentType(value)

  useEffect(() => {
    if (!value || !contentType) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(value)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [contentType, value])

  const select = (file?: File) => {
    if (!file) return
    const type = mediaContentType(file)
    if (!type || (type === 'application/pdf' && !allowPdf)) { setError(labels.invalidType); return }
    if (type === 'application/pdf' && file.size > maxPdfBytes) { setError(labels.pdfTooLarge); return }
    if (type !== 'application/pdf' && file.size > maxImageBytes) { setError(labels.imageTooLarge); return }
    setError(null)
    onChange(file)
  }
  const consume = (event: ChangeEvent<HTMLInputElement>) => {
    select(event.target.files?.[0])
    event.target.value = ''
  }
  const remove = () => { setError(null); setPreviewOpen(false); onChange(null) }
  const acceptedFiles = allowPdf ? 'image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf' : 'image/jpeg,image/png,.jpg,.jpeg,.png'

  return <div className={`evidence-capture${error ? ' evidence-capture--error' : ''}`}>
    <div className="evidence-capture__label" id={`${id}-label`}>{labels.label}{required && <span aria-hidden="true"> *</span>}</div>
    <input ref={cameraInput} className="sr-only" type="file" accept="image/*" capture={cameraFacingMode} disabled={disabled} onChange={consume} tabIndex={-1} />
    <input ref={fileInput} className="sr-only" type="file" accept={acceptedFiles} disabled={disabled} onChange={consume} tabIndex={-1} />
    {value && previewUrl ? <div className="evidence-capture__selected">
      <button type="button" className="evidence-capture__preview" onClick={() => setPreviewOpen(true)} disabled={disabled} aria-label={`${labels.preview}: ${value.name}`}>
        {contentType === 'application/pdf' ? <span><FileText size={28} /><small>PDF</small></span> : <MediaPreview source={previewUrl} contentType={contentType ?? value.type} name={value.name} compact />}
      </button>
      <div className="evidence-capture__file"><strong>{value.name}</strong><small>{formatFileSize(value.size)}</small></div>
      <div className="evidence-capture__actions">
        <button type="button" className="icon-button" onClick={() => setPreviewOpen(true)} aria-label={labels.preview} title={labels.preview}><Eye size={18} /></button>
        <button type="button" className="icon-button" onClick={() => fileInput.current?.click()} aria-label={labels.replaceFile} title={labels.replaceFile}><RotateCcw size={18} /></button>
        <button type="button" className="icon-button icon-button--danger" onClick={remove} aria-label={labels.removeFile} title={labels.removeFile}><Trash2 size={18} /></button>
      </div>
    </div> : <div className="evidence-capture__empty">
      <FileImage size={28} aria-hidden="true" />
      <p>{labels.emptyHint}</p>
      <div className="evidence-capture__sources">
        <button type="button" className="button button--secondary" onClick={() => cameraInput.current?.click()} disabled={disabled}><Camera size={18} />{labels.takePhoto}</button>
        <button type="button" className="button button--secondary" onClick={() => fileInput.current?.click()} disabled={disabled}><Images size={18} />{labels.chooseFile}</button>
      </div>
    </div>}
    {error && <small className="form-field__error" role="alert">{error}</small>}
    <OverlayDialog open={previewOpen && Boolean(previewUrl && value)} onClose={() => setPreviewOpen(false)} title={value?.name ?? labels.preview}>
      {previewUrl && value && <div className="media-preview"><MediaPreview source={previewUrl} contentType={contentType ?? value.type} name={value.name} /></div>}
    </OverlayDialog>
  </div>
}

function mediaContentType(file: File | null) {
  if (!file) return null
  const name = file.name.toLowerCase()
  if (file.type === 'image/jpeg' || /\.jpe?g$/.test(name)) return 'image/jpeg'
  if (file.type === 'image/png' || name.endsWith('.png')) return 'image/png'
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'application/pdf'
  return null
}

function formatFileSize(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
