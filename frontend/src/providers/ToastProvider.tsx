import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { motionDuration } from './motionPresets'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/Button'
import { IconButton } from '../components/ui/IconButton'

export type ToastTone = 'success' | 'error' | 'info'
export interface ToastOptions {
  title?: string
  message: string
  tone?: ToastTone
  duration?: number
  persistent?: boolean
  actionLabel?: string
  onAction?: () => void
}
interface ToastItem extends ToastOptions { id: number; tone: ToastTone }
interface ToastContextValue {
  notify: (messageOrOptions: string | ToastOptions, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const remove = useCallback((id: number) => setToasts((items) => items.filter((item) => item.id !== id)), [])
  const notify = useCallback((messageOrOptions: string | ToastOptions, fallbackTone: ToastTone = 'success') => {
    const options = typeof messageOrOptions === 'string'
      ? { message: messageOrOptions, tone: fallbackTone }
      : messageOrOptions
    const tone = options.tone ?? fallbackTone
    const id = Date.now() + Math.random()
    setToasts((items) => [
      ...items.filter((item) => item.message !== options.message || item.tone !== tone),
      { id, ...options, tone },
    ].slice(-3))
    if (!options.persistent) {
      window.setTimeout(() => remove(id), options.duration ?? 5000)
    }
  }, [remove])
  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        <AnimatePresence initial={false} mode="popLayout">
          {toasts.map((toast) => {
            const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? CircleAlert : Info
            return (
              <m.div layout key={toast.id} className={`toast toast--${toast.tone} surface surface--raised`} role={toast.tone === 'error' ? 'alert' : 'status'}
                initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 16, scale: 0.98 }} transition={{ duration: motionDuration.overlay }}>
                <Icon size={20} aria-hidden="true" />
                <span className="toast__content">
                  {toast.title && <strong>{toast.title}</strong>}
                  <span>{toast.message}</span>
                </span>
                {toast.actionLabel && toast.onAction && <Button type="button" variant="ghost" size="sm" className="text-button" onClick={() => {
                  toast.onAction?.()
                  remove(toast.id)
                }}>{toast.actionLabel}</Button>}
                <IconButton type="button" size="sm" onClick={() => remove(toast.id)} label={t('close')}>
                  <X size={18} aria-hidden="true" />
                </IconButton>
              </m.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
