import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { OverlayDialog } from '../OverlayDialog'
import { Button } from './Button'
import { IconButton } from './IconButton'

const dateKey = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-')

const dateFromKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : undefined
}

const shiftedDateKey = (days: number) => {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

export type DatePickerLabels = { placeholder: string; title: string; description: string; quick: string; today: string; tomorrow: string; inTwoDays: string; clear: string; cancel: string; choose: string; previousMonth: string; nextMonth: string; selected: string; weekdays: string[] }
const defaultLabels: DatePickerLabels = { placeholder: 'Chọn ngày hẹn trả', title: 'Chọn ngày hẹn trả', description: 'Chỉ chọn ngày, không cần chọn giờ.', quick: 'Chọn nhanh ngày hẹn trả', today: 'Hôm nay', tomorrow: 'Ngày mai', inTwoDays: '+2 ngày', clear: 'Xóa ngày', cancel: 'Hủy', choose: 'Chọn ngày', previousMonth: 'Tháng trước', nextMonth: 'Tháng sau', selected: 'Ngày đã chọn:', weekdays: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] }

const formatDate = (value: string, locale: string, placeholder: string) => {
  const date = dateFromKey(value)
  if (!date) return placeholder
  const formatted = new Intl.DateTimeFormat(locale, {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date)
  return formatted.charAt(0).toLocaleUpperCase('vi-VN') + formatted.slice(1)
}

const monthLabel = (date: Date, locale: string) => new Intl.DateTimeFormat(locale, {
  month: 'long', year: 'numeric',
}).format(date)

const calendarDays = (month: Date) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - mondayOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

export function DatePickerField({
  label,
  value,
  onChange,
  hint,
  required = false,
  disabled = false,
  locale = 'vi-VN',
  labels: suppliedLabels,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  required?: boolean
  disabled?: boolean
  locale?: string
  labels?: Partial<DatePickerLabels>
}) {
  const labels = { ...defaultLabels, ...suppliedLabels }
  const labelId = useId()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const selected = dateFromKey(value) ?? new Date()
    return new Date(selected.getFullYear(), selected.getMonth(), 1)
  })
  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth])
  const today = shiftedDateKey(0)

  const showPicker = () => {
    const selected = dateFromKey(value) ?? new Date()
    setDraft(value || dateKey(selected))
    setVisibleMonth(new Date(selected.getFullYear(), selected.getMonth(), 1))
    setOpen(true)
  }

  const moveSelection = (current: Date, amount: number) => {
    const next = new Date(current)
    next.setDate(current.getDate() + amount)
    const nextKey = dateKey(next)
    setDraft(nextKey)
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1))
    window.setTimeout(() => document.querySelector<HTMLButtonElement>(`[data-calendar-date="${nextKey}"]`)?.focus(), 0)
  }

  const onDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    const movement: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (movement[event.key] === undefined) return
    event.preventDefault()
    moveSelection(date, movement[event.key])
  }

  const chooseQuickDate = (offset: number) => onChange(shiftedDateKey(offset))

  return <div className="form-field date-picker-field">
    <span id={labelId} className="form-field__label">{label}{required && <span aria-hidden="true"> *</span>}</span>
    <button type="button" className={`date-picker-trigger${value ? ' date-picker-trigger--selected' : ''}`} aria-labelledby={labelId} aria-haspopup="dialog" aria-expanded={open && !disabled} disabled={disabled} onClick={showPicker}>
      <CalendarDays size={19} aria-hidden="true" />
      <span>{formatDate(value, locale, labels.placeholder)}</span>
      <ChevronDown size={18} aria-hidden="true" />
    </button>
    <div className="date-picker-quick-actions" aria-label={labels.quick}>
      <button type="button" disabled={disabled} aria-pressed={value === shiftedDateKey(0)} onClick={() => chooseQuickDate(0)}>{labels.today}</button>
      <button type="button" disabled={disabled} aria-pressed={value === shiftedDateKey(1)} onClick={() => chooseQuickDate(1)}>{labels.tomorrow}</button>
      <button type="button" disabled={disabled} aria-pressed={value === shiftedDateKey(2)} onClick={() => chooseQuickDate(2)}>{labels.inTwoDays}</button>
    </div>
    {hint && <span className="form-field__hint">{hint}</span>}

    <OverlayDialog
      open={open && !disabled}
      onClose={() => setOpen(false)}
      title={labels.title}
      description={labels.description}
      footer={<>
        {value && <Button className="date-picker-clear" type="button" variant="ghost" onClick={() => { onChange(''); setOpen(false) }}>{labels.clear}</Button>}
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{labels.cancel}</Button>
        <Button type="button" disabled={!draft} onClick={() => { onChange(draft); setOpen(false) }}>{labels.choose}</Button>
      </>}
    >
      <div className="date-picker-dialog">
        <div className="date-picker-dialog__quick" aria-label={labels.quick}>
          <button type="button" onClick={() => { setDraft(shiftedDateKey(0)); setVisibleMonth(new Date()) }}>{labels.today}</button>
          <button type="button" onClick={() => { setDraft(shiftedDateKey(1)); const next = dateFromKey(shiftedDateKey(1))!; setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1)) }}>{labels.tomorrow}</button>
          <button type="button" onClick={() => { setDraft(shiftedDateKey(2)); const next = dateFromKey(shiftedDateKey(2))!; setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1)) }}>{labels.inTwoDays}</button>
        </div>
        <div className="date-picker-dialog__month">
          <IconButton type="button" variant="secondary" label={labels.previousMonth} onClick={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft size={19} /></IconButton>
          <strong>{monthLabel(visibleMonth, locale)}</strong>
          <IconButton type="button" variant="secondary" label={labels.nextMonth} onClick={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight size={19} /></IconButton>
        </div>
        <div className="date-picker-calendar" role="grid" aria-label={monthLabel(visibleMonth, locale)}>
          {labels.weekdays.map(day => <span key={day} className="date-picker-calendar__weekday" role="columnheader">{day}</span>)}
          {days.map(date => {
            const key = dateKey(date)
            const selected = key === draft
            const outside = date.getMonth() !== visibleMonth.getMonth()
            return <span key={key} className="date-picker-calendar__cell" role="gridcell" aria-selected={selected}>
              <button
                type="button"
                data-calendar-date={key}
                className={`${selected ? 'selected ' : ''}${outside ? 'outside' : ''}`.trim()}
                aria-label={formatDate(key, locale, labels.placeholder)}
                aria-pressed={selected}
                aria-current={key === today ? 'date' : undefined}
                tabIndex={selected ? 0 : -1}
                onClick={() => setDraft(key)}
                onKeyDown={(event) => onDayKeyDown(event, date)}
              >{date.getDate()}</button>
            </span>
          })}
        </div>
        <p className="date-picker-dialog__selection">{labels.selected} <strong>{formatDate(draft, locale, labels.placeholder)}</strong></p>
      </div>
    </OverlayDialog>
  </div>
}
