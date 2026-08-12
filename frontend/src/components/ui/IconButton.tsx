import {
  forwardRef,
  useImperativeHandle,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { LiquidRipple, usePressRipple } from '../motion/LiquidRipple'
import type { ButtonSize, ButtonVariant } from './Button'
import type { LiquidRenderLevel } from '../glass/GlassSurface'

type IconButtonProps = {
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
  renderLevel?: LiquidRenderLevel
  loading?: boolean
  children: ReactNode
}

function iconButtonClassName(
  variant: ButtonVariant,
  size: ButtonSize,
  renderLevel: LiquidRenderLevel,
  className = '',
) {
  return [
    'icon-button',
    `icon-button--${variant}`,
    `icon-button--${size}`,
    `liquid-control liquid-render--${renderLevel}`,
    className,
  ].filter(Boolean).join(' ')
}

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & IconButtonProps>(
  function IconButton({
    label,
    variant = 'ghost',
    size = 'md',
    renderLevel = 'standard',
    loading = false,
    disabled,
    className,
    children,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onKeyDown,
    onKeyUp,
    onBlur,
    ...props
  }, forwardedRef) {
    const press = usePressRipple<HTMLButtonElement>(disabled || loading)
    useImperativeHandle(forwardedRef, () => press.ref.current as HTMLButtonElement)
    return (
      <button
        ref={press.ref}
        className={iconButtonClassName(variant, size, renderLevel, className)}
        aria-label={label}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        data-loading={String(loading)}
        data-liquid-managed="true"
        data-liquid-render={renderLevel}
        onPointerDown={(event) => { press.onPointerDown(event); onPointerDown?.(event) }}
        onPointerUp={(event) => { press.onPointerUp(); onPointerUp?.(event) }}
        onPointerCancel={(event) => { press.onPointerCancel(); onPointerCancel?.(event) }}
        onPointerLeave={(event) => { press.onPointerLeave(); onPointerLeave?.(event) }}
        onKeyDown={(event) => { press.onKeyDown(event); onKeyDown?.(event) }}
        onKeyUp={(event) => { press.onKeyUp(event); onKeyUp?.(event) }}
        onBlur={(event) => { press.onBlur(); onBlur?.(event) }}
        {...props}
      >
        <LiquidRipple />
        {loading ? <span className="button__spinner" aria-hidden="true" /> : children}
      </button>
    )
  },
)

export function IconButtonLink({
  label,
  variant = 'ghost',
  size = 'md',
  renderLevel = 'standard',
  loading = false,
  disabled = false,
  className,
  children,
  onClick,
  ...props
}: LinkProps & IconButtonProps & { disabled?: boolean }) {
  const press = usePressRipple<HTMLAnchorElement>(disabled || loading)
  return (
    <Link
      ref={press.ref}
      className={iconButtonClassName(variant, size, renderLevel, className)}
      aria-label={label}
      aria-disabled={disabled || loading || undefined}
      aria-busy={loading || undefined}
      tabIndex={disabled ? -1 : props.tabIndex}
      data-loading={String(loading)}
      data-liquid-managed="true"
      data-liquid-render={renderLevel}
      onPointerDown={press.onPointerDown}
      onPointerUp={press.onPointerUp}
      onPointerCancel={press.onPointerCancel}
      onPointerLeave={press.onPointerLeave}
      onKeyDown={press.onKeyDown}
      onKeyUp={press.onKeyUp}
      onBlur={press.onBlur}
      onClick={(event) => {
        if (disabled || loading) event.preventDefault()
        onClick?.(event)
      }}
      {...props}
    >
      <LiquidRipple />
      {loading ? <span className="button__spinner" aria-hidden="true" /> : children}
    </Link>
  )
}
