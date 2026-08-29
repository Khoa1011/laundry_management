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
const HOVER_CLOSE_DELAY_MS = 320
const ACTION_MENU_OPEN_EVENT = 'laundry:action-menu-open'

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
  const activeRef = useRef(false)
  const focusFirstRef = useRef(false)
  const hoverOpenedRef = useRef(false)
  const lastPointerRef = useRef({ x: -1, y: -1 })
  const menuId = useId()
  const itemCount = Children.count(children)

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
    activeRef.current = false
    hoverOpenedRef.current = false
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
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
    activeRef.current = true
    focusFirstRef.current = focusFirst
    window.dispatchEvent(new CustomEvent(ACTION_MENU_OPEN_EVENT, { detail: menuId }))
    updatePosition()
    setMounted(true)
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = window.requestAnimationFrame(() => {
        setOpen(true)
        animationFrameRef.current = null
      })
    })
  }, [clearExitTimer, clearHoverTimer, menuId, updatePosition])

  useEffect(() => {
    const handleOtherMenuOpen = (event: Event) => {
      if ((event as CustomEvent<string>).detail === menuId || !activeRef.current) return
      close()
    }

    window.addEventListener(ACTION_MENU_OPEN_EVENT, handleOtherMenuOpen)
    return () => window.removeEventListener(ACTION_MENU_OPEN_EVENT, handleOtherMenuOpen)
  }, [close, menuId])

  const pointerIsWithinInteraction = useCallback(() => {
    const { x, y } = lastPointerRef.current
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || x < 0 || y < 0) return false

    const rects = [
      trigger.getBoundingClientRect(),
      ...Array.from(menu?.querySelectorAll<HTMLElement>(':scope > a, :scope > button') ?? [])
        .map((element) => element.getBoundingClientRect()),
    ].filter((rect) => rect.width > 0 && rect.height > 0)
    if (rects.length === 0) return false

    const padding = 6
    const left = Math.min(...rects.map((rect) => rect.left)) - padding
    const right = Math.max(...rects.map((rect) => rect.right)) + padding
    const top = Math.min(...rects.map((rect) => rect.top)) - padding
    const bottom = Math.max(...rects.map((rect) => rect.bottom)) + padding
    return x >= left && x <= right && y >= top && y <= bottom
  }, [])

  const scheduleHoverClose = useCallback(() => {
    if (!hoverOpenedRef.current) return
    clearHoverTimer()
    hoverTimerRef.current = window.setTimeout(() => {
      hoverTimerRef.current = null
      if (!pointerIsWithinInteraction()) close()
    }, HOVER_CLOSE_DELAY_MS)
  }, [clearHoverTimer, close, pointerIsWithinInteraction])

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
    const handlePointerMove = (event: PointerEvent) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY }
      if (!hoverOpenedRef.current) return
      if (pointerIsWithinInteraction()) clearHoverTimer()
      else scheduleHoverClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close(true)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [clearHoverTimer, close, mounted, pointerIsWithinInteraction, scheduleHoverClose, updatePosition])

  useEffect(() => () => {
    clearExitTimer()
    clearHoverTimer()
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current)
  }, [clearExitTimer, clearHoverTimer])

  const handleMenuClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (target instanceof Element && target.closest('[role="menuitem"], a, button')) close()
  }

  const handleHoverOpen = (event: ReactMouseEvent<HTMLSpanElement>) => {
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return
    lastPointerRef.current = { x: event.clientX, y: event.clientY }
    hoverOpenedRef.current = true
    clearHoverTimer()
    if (open) return
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
