import { useEffect } from 'react'
import { spawnLiquidRipple } from './LiquidRipple'

const LEGACY_INTERACTIVE_SELECTOR = [
  '.button',
  '.icon-button',
  '.nav-item',
  '.mobile-bottom-nav a',
  '.action-menu__content button',
  '[data-liquid-legacy="true"]',
].join(',')

function getLegacyControl(eventTarget: EventTarget | null) {
  if (!(eventTarget instanceof Element)) return null
  const target = eventTarget.closest<HTMLElement>(LEGACY_INTERACTIVE_SELECTOR)
  if (!target || target.dataset.liquidManaged === 'true') return null
  return target
}

export function LiquidInteractionRoot() {
  useEffect(() => {
    const pressed = new Set<HTMLElement>()

    const release = () => {
      pressed.forEach((target) => delete target.dataset.pressing)
      pressed.clear()
    }
    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (event.button !== 0) return
      const target = getLegacyControl(event.target)
      if (!target) return
      target.dataset.pressing = 'true'
      pressed.add(target)
      spawnLiquidRipple(target, { clientX: event.clientX, clientY: event.clientY })
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return
      const target = getLegacyControl(event.target)
      if (!target) return
      target.dataset.pressing = 'true'
      pressed.add(target)
      spawnLiquidRipple(target)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointerup', release, true)
    document.addEventListener('pointercancel', release, true)
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('keyup', release, true)
    window.addEventListener('blur', release)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointerup', release, true)
      document.removeEventListener('pointercancel', release, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('keyup', release, true)
      window.removeEventListener('blur', release)
      release()
    }
  }, [])

  return null
}
