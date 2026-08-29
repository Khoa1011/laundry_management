import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import type { ButtonSize, ButtonVariant } from './Button'

type IconButtonVariant = Exclude<ButtonVariant, 'create'>

type IconButtonProps = {
  label: string
  variant?: IconButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: ReactNode
}

function iconButtonClassName(variant: IconButtonVariant, size: ButtonSize, className = '') {
  return ['icon-button', `icon-button--${variant}`, `icon-button--${size}`, className].filter(Boolean).join(' ')
}

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & IconButtonProps>(
  function IconButton({
    label,
    variant = 'ghost',
    size = 'md',
    loading = false,
    disabled,
    className,
    children,
    ...props
  }, ref) {
    return (
      <button
        ref={ref}
        className={iconButtonClassName(variant, size, className)}
        aria-label={label}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        data-loading={String(loading)}
        {...props}
      >
        {loading ? <span className="button__spinner" aria-hidden="true" /> : children}
      </button>
    )
  },
)

export function IconButtonLink({
  label,
  variant = 'ghost',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  children,
  onClick,
  ...props
}: LinkProps & IconButtonProps & { disabled?: boolean }) {
  return (
    <Link
      className={iconButtonClassName(variant, size, className)}
      aria-label={label}
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
      {loading ? <span className="button__spinner" aria-hidden="true" /> : children}
    </Link>
  )
}
