import {
  forwardRef,
  useImperativeHandle,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { LiquidRipple, usePressRipple } from '../motion/LiquidRipple'
import type { LiquidRenderLevel } from '../glass/GlassSurface'

export type ButtonVariant =
  | 'primary'
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
  renderLevel?: LiquidRenderLevel
  loading?: boolean
  loadingLabel?: string
}

function buttonClassName(
  variant: ButtonVariant,
  size: ButtonSize,
  renderLevel: LiquidRenderLevel,
  className = '',
) {
  return [
    'button',
    `button--${variant}`,
    `button--${size}`,
    `liquid-control liquid-render--${renderLevel}`,
    className,
  ].filter(Boolean).join(' ')
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & SharedButtonProps>(
  function Button({
    variant = 'primary',
    size = 'md',
    renderLevel = 'standard',
    loading = false,
    loadingLabel,
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
        className={buttonClassName(variant, size, renderLevel, className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
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
        {loading && <span className="button__spinner" aria-hidden="true" />}
        <span className="button__content">{loadingLabel ?? children}</span>
      </button>
    )
  },
)

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  renderLevel = 'standard',
  loading = false,
  disabled = false,
  className,
  children,
  onClick,
  ...props
}: LinkProps & SharedButtonProps & {
  disabled?: boolean
  children: ReactNode
}) {
  const press = usePressRipple<HTMLAnchorElement>(disabled || loading)
  return (
    <Link
      ref={press.ref}
      className={buttonClassName(variant, size, renderLevel, className)}
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
      {loading && <span className="button__spinner" aria-hidden="true" />}
      <span className="button__content">{children}</span>
    </Link>
  )
}
