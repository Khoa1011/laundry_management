import type { ReactElement } from 'react'

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactElement
}) {
  return (
    <label className={`form-field${error ? ' form-field--error' : ''}`}>
      <span className="form-field__label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="form-field__hint">{hint}</span>}
      {error && <span className="form-field__error" role="alert">{error}</span>}
    </label>
  )
}
