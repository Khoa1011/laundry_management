import { useId } from 'react'
import { formatMoneyInput, formatVietnameseMoneySummary, sanitizeMoneyInput } from '../utils/money'

export interface MoneyInputProps {
  value: string
  onValueChange: (value: string) => void
  label: string
  currency?: string
  id?: string
  required?: boolean
  disabled?: boolean
  error?: string
  placeholder?: string
  maxIntegerDigits?: number
  fractionDigits?: number
  preserveInput?: boolean
  hint?: string
}

export function MoneyInput({
  value,
  onValueChange,
  label,
  currency = 'VND',
  id,
  required = false,
  disabled = false,
  error,
  placeholder = '0',
  maxIntegerDigits = 15,
  fractionDigits = 0,
  preserveInput = false,
  hint,
}: MoneyInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-money-hint`
  const errorId = `${inputId}-money-error`
  const summary = hint ?? (currency === 'VND' ? formatVietnameseMoneySummary(value) : value ? `${formatMoneyInput(value)} ${currency}` : '')

  return <div className={`form-field money-input${error ? ' form-field--error' : ''}`}>
    <label className="form-field__label" htmlFor={inputId}>{label}{required && <span aria-hidden="true"> *</span>}</label>
    <div className="money-input__control">
      <input id={inputId} type="text" inputMode={fractionDigits ? 'decimal' : 'numeric'} autoComplete="off"
        value={preserveInput ? value : formatMoneyInput(value)} placeholder={placeholder} disabled={disabled} aria-invalid={Boolean(error)}
        aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`}
        onChange={(event) => onValueChange(preserveInput ? event.target.value : sanitizeMoneyInput(event.target.value, { maxIntegerDigits, fractionDigits }))} />
      <span aria-hidden="true">{currency}</span>
    </div>
    <small id={hintId} className="money-input__summary" aria-live="polite">{summary || '\u00a0'}</small>
    {error && <small id={errorId} className="form-field__error">{error}</small>}
  </div>
}
