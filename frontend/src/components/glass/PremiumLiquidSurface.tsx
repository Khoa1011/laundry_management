import type { HTMLAttributes, ReactNode } from 'react'
import { GlassSurface, type GlassVariant, type LiquidRenderLevel } from './GlassSurface'

export function PremiumLiquidSurface({
  variant = 'strong',
  renderLevel = 'premium',
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLElement> & {
  variant?: GlassVariant
  renderLevel?: LiquidRenderLevel
  children: ReactNode
}) {
  return (
    <GlassSurface
      variant={variant}
      renderLevel={renderLevel}
      className={`premium-liquid-surface${className ? ` ${className}` : ''}`}
      {...props}
    >
      <span className="premium-liquid-surface__edge" aria-hidden="true" />
      <span className="premium-liquid-surface__refraction" aria-hidden="true" />
      <span className="premium-liquid-surface__content">{children}</span>
    </GlassSurface>
  )
}
