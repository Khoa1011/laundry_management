import { DotsThreeOutlineIcon } from '@phosphor-icons/react'
import { createPortal } from 'react-dom'
import {
  Children,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { IconButton } from './IconButton'

const VIEWPORT_GUTTER = 12
const ITEM_STEP = 52
const EXIT_DURATION_MS = 180
const HOVER_CLOSE_DELAY_MS = 140

type MenuPosition = {
  left: number
  top: number
}

type MenuSide = 'left' | 'right'

type ActionMenuProps = {
  children: ReactNode
  className?: string
  label: string
}

export function ActionMenu({ children, className = '', label }: ActionMenuProps) {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition>({ left: VIEWPORT_GUTTER, top: VIEWPORT_GUTTER })
  const [side, setSide] = useState<MenuSide>('left')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const exitTimerRef = useRef<number | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const focusFirstRef = useRef(false)
  const hoverOpenedRef = useRef(false)
  const menuId = useId()
  const itemCount = Math.min(Children.count(children), 3)

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
    exitTimerRef.current = null
  }, [])

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
  }, [])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const reach = Math.max(1, itemCount) * ITEM_STEP + VIEWPORT_GUTTER
    const nextSide: MenuSide = centerX >= reach ? 'left' : 'right'
    const minX = nextSide === 'left' ? reach : VIEWPORT_GUTTER
    const maxX = nextSide === 'right' ? window.innerWidth - reach : window.innerWidth - VIEWPORT_GUTTER

    setSide(nextSide)
    setPosition({
      left: Math.min(Math.max(centerX, minX), Math.max(minX, maxX)),
      top: Math.min(Math.max(centerY, 48), Math.max(48, window.innerHeight - 48)),
    })
  }, [itemCount])

  const close = useCallback((restoreFocus = false) => {
    clearHoverTimer()
    clearExitTimer()
    hoverOpenedRef.current = false
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
    exitTimerRef.current = window.setTimeout(() => {
      setMounted(false)
      exitTimerRef.current = null
    }, EXIT_DURATION_MS)
  }, [clearExitTimer, clearHoverTimer])

  const openMenu = useCallback((focusFirst: boolean) => {
    clearHoverTimer()
    clearExitTimer()
    focusFirstRef.current = focusFirst
    updatePosition()
    setMounted(true)
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = window.requestAnimationFrame(() => {
        setOpen(true)
        animationFrameRef.current = null
      })
    })
  }, [clearExitTimer, clearHoverTimer, updatePosition])

  const scheduleHoverClose = useCallback(() => {
    if (!hoverOpenedRef.current) return
    clearHoverTimer()
    hoverTimerRef.current = window.setTimeout(() => close(), HOVER_CLOSE_DELAY_MS)
  }, [clearHoverTimer, close])

  useLayoutEffect(() => {
    if (mounted) updatePosition()
  }, [mounted, updatePosition])

  useEffect(() => {
    if (!open || !focusFirstRef.current) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"], a, button')?.focus()
    focusFirstRef.current = false
  }, [open])

  useEffect(() => {
    if (!mounted) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      close()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close(true)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [close, mounted, updatePosition])

  useEffect(() => () => {
    clearExitTimer()
    clearHoverTimer()
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current)
  }, [clearExitTimer, clearHoverTimer])

  const handleMenuClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (target instanceof Element && target.closest('[role="menuitem"], a, button')) close()
  }

  const handleHoverOpen = () => {
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return
    hoverOpenedRef.current = true
    openMenu(false)
  }

  const menuStyle = { left: position.left, top: position.top } satisfies CSSProperties

  return <span
    className={['action-menu', className].filter(Boolean).join(' ')}
    onMouseEnter={handleHoverOpen}
    onMouseLeave={scheduleHoverClose}
  >
    <IconButton
      ref={triggerRef}
      type="button"
      className="action-menu__trigger"
      label={label}
      aria-controls={mounted ? menuId : undefined}
      aria-expanded={open}
      aria-haspopup="menu"
      onClick={() => {
        if (open && !hoverOpenedRef.current) close()
        else {
          hoverOpenedRef.current = false
          openMenu(true)
        }
      }}
    >
      <DotsThreeOutlineIcon size={25} weight="fill" aria-hidden="true" />
    </IconButton>
    {mounted && createPortal(
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        className="action-menu__content action-menu__content--portal"
        data-open={open}
        data-side={side}
        style={menuStyle}
        onClick={handleMenuClick}
        onMouseEnter={clearHoverTimer}
        onMouseLeave={scheduleHoverClose}
      >
        {children}
      </div>,
      document.body,
    )}
  </span>
}
