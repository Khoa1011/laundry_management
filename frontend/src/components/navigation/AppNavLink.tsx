import type { MouseEvent } from 'react'
import { NavLink, useLocation, useNavigate, type NavLinkProps } from 'react-router-dom'
import { scheduleNavigation } from './navigationScheduler'

export function AppNavLink({
  className = 'nav-item',
  activeClassName = 'nav-item--active',
  indicatorId,
  children,
  onClick,
  reloadDocument,
  target,
  to,
  ...props
}: Omit<NavLinkProps, 'className'> & {
  className?: string
  activeClassName?: string
  indicatorId?: string
}) {
  const location = useLocation()
  const navigate = useNavigate()

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented
      || reloadDocument
      || (target && target !== '_self')
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey) return

    event.preventDefault()
    const currentLocation = `${location.pathname}${location.search}${location.hash}`
    if (typeof to === 'string' && to === currentLocation) return

    scheduleNavigation(() => {
      void navigate(to, {
        preventScrollReset: props.preventScrollReset,
        relative: props.relative,
        replace: props.replace,
        state: props.state,
        viewTransition: props.viewTransition,
      })
    })
  }

  return (
    <NavLink
      className={({ isActive }) => `${className}${isActive && activeClassName ? ` ${activeClassName}` : ''}`}
      onClick={handleClick}
      reloadDocument={reloadDocument}
      target={target}
      to={to}
      {...props}
    >
      {({ isActive }) => (
        <>
          {isActive && indicatorId && (
            <span
              className="nav-active-indicator"
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
