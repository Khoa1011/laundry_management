import { m, useReducedMotion } from 'motion/react'
import { NavLink, type NavLinkProps } from 'react-router-dom'
import { motionDuration, motionEase } from '../../providers/motionPresets'

export function AppNavLink({
  className = 'nav-item',
  activeClassName = 'nav-item--active',
  indicatorId,
  children,
  ...props
}: Omit<NavLinkProps, 'className'> & {
  className?: string
  activeClassName?: string
  indicatorId?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <NavLink
      className={({ isActive }) => `${className}${isActive && activeClassName ? ` ${activeClassName}` : ''}`}
      {...props}
    >
      {({ isActive }) => (
        <>
          {isActive && indicatorId && (
            <m.span
              className="nav-active-indicator"
              layoutId={indicatorId}
              transition={{ duration: reduceMotion ? 0 : motionDuration.structural, ease: motionEase }}
              aria-hidden="true"
            />
          )}
          <span className="nav-item__content">
            {typeof children === 'function'
              ? children({ isActive, isPending: false, isTransitioning: false })
              : children}
          </span>
        </>
      )}
    </NavLink>
  )
}
