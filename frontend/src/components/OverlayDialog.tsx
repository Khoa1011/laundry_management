import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface OverlayDialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  variant?: 'dialog' | 'drawer'
  closeOnBackdrop?: boolean
}

export function OverlayDialog({ open, onClose, title, description, children, footer, variant = 'dialog', closeOnBackdrop = false }: OverlayDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const originalOverflow = document.body.style.overflow
    const appRoot = document.getElementById('root')
    const originalAriaHidden = appRoot?.getAttribute('aria-hidden')
    const wasInert = appRoot?.hasAttribute('inert') ?? false
    document.body.style.overflow = 'hidden'
    appRoot?.setAttribute('aria-hidden', 'true')
    appRoot?.setAttribute('inert', '')
    const panel = panelRef.current
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])
    window.setTimeout(() => focusable()[0]?.focus(), 0)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      if (originalAriaHidden === null) appRoot?.removeAttribute('aria-hidden')
      else if (originalAriaHidden !== undefined) appRoot?.setAttribute('aria-hidden', originalAriaHidden)
      if (!wasInert) appRoot?.removeAttribute('inert')
      document.removeEventListener('keydown', handleKeyDown)
      previous?.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className={`overlay overlay--${variant}`} role="presentation" onMouseDown={(event) => {
      if (closeOnBackdrop && event.target === event.currentTarget) onClose()
    }}>
      <div ref={panelRef} className="overlay__panel" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
        <header className="overlay__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('close')}><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="overlay__body">{children}</div>
        {footer && <footer className="overlay__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel, pending = false, tone = 'primary', children }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: string; confirmLabel: string; pending?: boolean; tone?: 'primary' | 'danger'; children?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <OverlayDialog open={open} onClose={onClose} title={title} closeOnBackdrop={false} footer={<>
      <button type="button" className="button button--secondary" onClick={onClose} disabled={pending}>{t('cancel')}</button>
      <button type="button" className={`button button--${tone}`} onClick={onConfirm} disabled={pending}>{pending ? t('saving') : confirmLabel}</button>
    </>}>
      <p className="dialog-copy">{body}</p>{children}
    </OverlayDialog>
  )
}
