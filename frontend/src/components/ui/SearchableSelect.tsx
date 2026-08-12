import { ChevronDown, Search, X } from 'lucide-react'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'

export type SearchableSelectOption = {
  value: string
  label: string
}

type SearchableSelectProps = {
  value: string
  options: SearchableSelectOption[]
  placeholder: string
  selectAriaLabel: string
  searchPlaceholder: string
  noResultsText: string
  loading?: boolean
  loadingText?: string
  disabled?: boolean
  onChange: (value: string) => void
  autoComplete?: InputHTMLAttributes<HTMLInputElement>['autoComplete']
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replaceAll('\u0111', 'd')
    .replaceAll('\u0110', 'D')
    .toLocaleLowerCase('vi')
    .trim()
}

export function SearchableSelect({
  value,
  options,
  placeholder,
  selectAriaLabel,
  searchPlaceholder,
  noResultsText,
  loading = false,
  loadingText = placeholder,
  disabled = false,
  onChange,
  autoComplete,
}: SearchableSelectProps) {
  const inputId = useId()
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [listboxStyle, setListboxStyle] = useState<CSSProperties>({})
  const selectedOption = options.find((option) => option.value === value)
  const normalizedQuery = normalizeSearch(query)
  const filteredOptions = useMemo(
    () => normalizedQuery
      ? options.filter((option) => normalizeSearch(option.label).includes(normalizedQuery))
      : options,
    [normalizedQuery, options],
  )
  const unavailable = disabled || loading
  const inputValue = open ? query : selectedOption?.label ?? ''
  const activeOption = filteredOptions[activeIndex]

  const updateListboxPosition = () => {
    const rect = inputRef.current?.getBoundingClientRect()
    if (!rect) return
    const gap = 4
    const viewportPadding = 8
    const viewportHeight = window.innerHeight
    const spaceBelow = viewportHeight - rect.bottom - viewportPadding
    const spaceAbove = rect.top - viewportPadding
    const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow
    setListboxStyle({
      left: rect.left,
      top: openAbove ? undefined : rect.bottom + gap,
      bottom: openAbove ? viewportHeight - rect.top + gap : undefined,
      width: rect.width,
      maxHeight: Math.max(96, openAbove ? spaceAbove : spaceBelow),
    })
  }

  useEffect(() => {
    if (unavailable) {
      setQuery('')
      setOpen(false)
    }
  }, [unavailable])

  useEffect(() => {
    if (!open) return
    updateListboxPosition()
    const handlePositionUpdate = () => updateListboxPosition()
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (inputRef.current?.closest('.searchable-select')?.contains(target)) return
      const listbox = document.getElementById(listboxId)
      if (listbox?.contains(target)) return
      setOpen(false)
      setQuery('')
    }
    window.addEventListener('resize', handlePositionUpdate)
    window.addEventListener('scroll', handlePositionUpdate, true)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('resize', handlePositionUpdate)
      window.removeEventListener('scroll', handlePositionUpdate, true)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [listboxId, open])

  useEffect(() => {
    setActiveIndex(0)
  }, [normalizedQuery, options])

  const openPicker = () => {
    if (unavailable) return
    setOpen(true)
    setQuery(selectedOption?.label ?? '')
    requestAnimationFrame(() => {
      inputRef.current?.select()
      updateListboxPosition()
    })
  }

  const selectOption = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div className="searchable-select" data-open={open ? 'true' : 'false'}>
      <div className="searchable-select__control">
        <Search size={17} aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          role="combobox"
          value={inputValue}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={openPicker}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
              setActiveIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)))
              return
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setOpen(true)
              setActiveIndex((current) => Math.max(current - 1, 0))
              return
            }
            if (event.key === 'Enter' && open && activeOption) {
              event.preventDefault()
              selectOption(activeOption.value)
              return
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
              setQuery('')
            }
          }}
          placeholder={loading ? loadingText : searchPlaceholder}
          aria-label={selectAriaLabel}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && activeOption ? `${listboxId}-${activeOption.value}` : undefined}
          disabled={unavailable}
          autoComplete={autoComplete ?? 'off'}
          spellCheck={false}
        />
        {Boolean(value || query) && !unavailable && (
          <button
            type="button"
            className="searchable-select__clear"
            onClick={() => {
              onChange('')
              setQuery('')
              setOpen(false)
              inputRef.current?.focus()
            }}
            aria-label={placeholder}
          >
            <X size={17} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="searchable-select__toggle"
          onClick={() => {
            if (open) {
              setOpen(false)
              setQuery('')
            } else {
              openPicker()
            }
          }}
          disabled={unavailable}
          aria-label={placeholder}
          aria-expanded={open}
          aria-controls={listboxId}
        >
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      </div>
      {open && createPortal(
        <div
          id={listboxId}
          className="searchable-select__listbox"
          role="listbox"
          aria-label={placeholder}
          style={listboxStyle}
        >
          {!loading && filteredOptions.map((option, index) => (
            <button
              key={option.value}
              id={`${listboxId}-${option.value}`}
              type="button"
              role="option"
              className="searchable-select__option"
              aria-selected={option.value === value}
              data-active={index === activeIndex ? 'true' : 'false'}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option.value)}
            >
              {option.label}
            </button>
          ))}
          {!loading && filteredOptions.length === 0 && (
            <div className="searchable-select__empty" role="status">{noResultsText}</div>
          )}
          {loading && (
            <div className="searchable-select__empty" role="status">{loadingText}</div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
