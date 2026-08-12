import type { ElementType, HTMLAttributes, ReactNode } from 'react'

export type GlassVariant = 'subtle' | 'standard' | 'strong' | 'opaque'
export type LiquidRenderLevel = 'premium' | 'standard' | 'reduced'

export function GlassSurface({
  as: Component = 'div',
  variant = 'standard',
  renderLevel = 'standard',
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: ElementType
  variant?: GlassVariant
  renderLevel?: LiquidRenderLevel
  children: ReactNode
}) {
  return (
    <Component
      className={[
        'glass-surface',
        `glass-surface--${variant}`,
        `liquid-render--${renderLevel}`,
        className,
      ].filter(Boolean).join(' ')}
      data-liquid-render={renderLevel}
      {...props}
    >
      {children}
    </Component>
  )
}
