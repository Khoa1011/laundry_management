import type { ElementType, HTMLAttributes, ReactNode } from 'react'

export type SurfaceVariant = 'base' | 'raised' | 'subtle' | 'selected'

export function Surface({
  as: Component = 'div',
  variant = 'base',
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: ElementType
  variant?: SurfaceVariant
  children: ReactNode
}) {
  return (
    <Component
      className={['surface', `surface--${variant}`, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </Component>
  )
}
