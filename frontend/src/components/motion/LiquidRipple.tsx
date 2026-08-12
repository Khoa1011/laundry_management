/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'

const MAX_ACTIVE_RIPPLES = 4
const RIPPLE_CLEANUP_MS = 700
const REDUCED_CLEANUP_MS = 180

type RippleOrigin = {
  clientX: number
  clientY: number
}

type RippleCleanup = () => void

function getMotionLevel() {
  const configured = document.documentElement.dataset.motionLevel
  if (configured === 'off') return 'off'
  if (configured === 'reduced') return 'reduced'
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'reduced'
  return 'full'
}

function isDisabled(target: HTMLElement) {
  return (
    target.matches(':disabled')
    || target.getAttribute('aria-disabled') === 'true'
    || target.dataset.loading === 'true'
  )
}

export function spawnLiquidRipple(
  target: HTMLElement,
  origin?: RippleOrigin,
): RippleCleanup {
  if (isDisabled(target)) return () => undefined

  const motionLevel = getMotionLevel()
  if (motionLevel === 'off') return () => undefined

  const rect = target.getBoundingClientRect()
  const x = origin ? origin.clientX - rect.left : rect.width / 2
  const y = origin ? origin.clientY - rect.top : rect.height / 2
  const radius = Math.hypot(
    Math.max(x, rect.width - x),
    Math.max(y, rect.height - y),
  )
  const ripple = document.createElement('span')
  const activeRipples = target.querySelectorAll(':scope > .liquid-ripple')

  activeRipples.forEach((activeRipple, index) => {
    if (index <= activeRipples.length - MAX_ACTIVE_RIPPLES) activeRipple.remove()
  })

  ripple.className = `liquid-ripple${motionLevel === 'reduced' ? ' liquid-ripple--reduced' : ''}`
  ripple.setAttribute('aria-hidden', 'true')
  ripple.style.setProperty('--ripple-x', `${x}px`)
  ripple.style.setProperty('--ripple-y', `${y}px`)
  ripple.style.setProperty('--ripple-size', `${Math.max(radius * 2, 1)}px`)
  target.append(ripple)

  let removed = false
  const remove = () => {
    if (removed) return
    removed = true
    window.clearTimeout(timeoutId)
    ripple.removeEventListener('animationend', remove)
    ripple.remove()
  }
  const timeoutId = window.setTimeout(
    remove,
    motionLevel === 'reduced' ? REDUCED_CLEANUP_MS : RIPPLE_CLEANUP_MS,
  )
  ripple.addEventListener('animationend', remove, { once: true })

  return remove
}

export function LiquidRipple() {
  return <span className="liquid-control__material" aria-hidden="true" />
}

export function usePressRipple<T extends HTMLElement>(disabled = false) {
  const ref = useRef<T>(null)
  const cleanups = useRef(new Set<RippleCleanup>())

  const registerRipple = useCallback((origin?: RippleOrigin) => {
    if (disabled || !ref.current) return
    const cleanup = spawnLiquidRipple(ref.current, origin)
    cleanups.current.add(cleanup)
    window.setTimeout(() => cleanups.current.delete(cleanup), RIPPLE_CLEANUP_MS)
  }, [disabled])

  const setPressed = useCallback((pressed: boolean) => {
    if (!ref.current) return
    if (pressed) ref.current.dataset.pressing = 'true'
    else delete ref.current.dataset.pressing
  }, [])

  useEffect(() => () => {
    cleanups.current.forEach((cleanup) => cleanup())
    cleanups.current.clear()
  }, [])

  return {
    ref,
    onPointerDown: (event: PointerEvent<T>) => {
      if (disabled || event.button !== 0) return
      setPressed(true)
      registerRipple({ clientX: event.clientX, clientY: event.clientY })
    },
    onPointerUp: () => setPressed(false),
    onPointerCancel: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    onKeyDown: (event: KeyboardEvent<T>) => {
      if (disabled || event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return
      setPressed(true)
      registerRipple()
    },
    onKeyUp: (event: KeyboardEvent<T>) => {
      if (event.key === 'Enter' || event.key === ' ') setPressed(false)
    },
    onBlur: () => setPressed(false),
  }
}
