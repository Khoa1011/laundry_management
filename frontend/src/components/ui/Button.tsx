import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

export type ButtonVariant =
  | 'primary'
  | 'create'
  | 'secondary'
  | 'subtle'
  | 'ghost'
  | 'outline'
  | 'danger'
  | 'success'
export type ButtonSize = 'sm' | 'md' | 'lg'

type SharedButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  loadingLabel?: string
}

function buttonClassName(variant: ButtonVariant, size: ButtonSize, className = '') {
  return ['button', `button--${variant}`, `button--${size}`, className].filter(Boolean).join(' ')
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & SharedButtonProps>(
  function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingLabel,
    disabled,
    className,
    children,
    ...props
  }, ref) {
    return (
      <button
        ref={ref}
        className={buttonClassName(variant, size, className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        data-loading={String(loading)}
        {...props}
      >
        {loading && <span className="button__spinner" aria-hidden="true" />}
        <span className="button__content">{loading ? (loadingLabel ?? children) : children}</span>
      </button>
    )
  },
)

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel,
  disabled = false,
  className,
  children,
  onClick,
  ...props
}: LinkProps & SharedButtonProps & { disabled?: boolean; children: ReactNode }) {
  return (
    <Link
      className={buttonClassName(variant, size, className)}
      aria-disabled={disabled || loading || undefined}
      aria-busy={loading || undefined}
      tabIndex={disabled || loading ? -1 : props.tabIndex}
      data-loading={String(loading)}
      onClick={(event) => {
        if (disabled || loading) event.preventDefault()
        onClick?.(event)
      }}
      {...props}
    >
      {loading && <span className="button__spinner" aria-hidden="true" />}
      <span className="button__content">{loading ? (loadingLabel ?? children) : children}</span>
    </Link>
  )
}
