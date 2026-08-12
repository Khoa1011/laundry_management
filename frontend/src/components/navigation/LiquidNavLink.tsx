import { m } from 'motion/react'
import { NavLink, type NavLinkProps } from 'react-router-dom'
import { motionSpring } from '../../providers/motionPresets'
import { usePressRipple } from '../motion/LiquidRipple'

export function LiquidNavLink({
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
  const press = usePressRipple<HTMLAnchorElement>()

  return (
    <NavLink
      ref={press.ref}
      className={({ isActive }) => `${className}${isActive && activeClassName ? ` ${activeClassName}` : ''}`}
      data-liquid-managed="true"
      onPointerDown={press.onPointerDown}
      onPointerUp={press.onPointerUp}
      onPointerCancel={press.onPointerCancel}
      onPointerLeave={press.onPointerLeave}
      onKeyDown={press.onKeyDown}
      onKeyUp={press.onKeyUp}
      onBlur={press.onBlur}
      {...props}
    >
      {({ isActive }) => (
        <>
          {isActive && indicatorId && (
            <m.span
              className="liquid-nav-indicator"
              layoutId={indicatorId}
              transition={motionSpring.sharedIndicator}
              aria-hidden="true"
            />
          )}
          <span className="liquid-nav-content">{typeof children === 'function' ? children({ isActive, isPending: false, isTransitioning: false }) : children}</span>
        </>
      )}
    </NavLink>
  )
}
