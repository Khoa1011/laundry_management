let bodyScrollLockCount = 0
let originalBodyOverflow = ''
let applicationModalLockCount = 0
let applicationRoot: HTMLElement | null = null
let originalRootAriaHidden: string | null = null
let rootWasInert = false

export function acquireBodyScrollLock() {
  if (bodyScrollLockCount === 0) {
    originalBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  bodyScrollLockCount += 1
  let released = false

  return () => {
    if (released) return
    released = true
    bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1)
    if (bodyScrollLockCount === 0) document.body.style.overflow = originalBodyOverflow
  }
}

export function acquireApplicationModalLock() {
  const releaseBodyScroll = acquireBodyScrollLock()
  const root = document.getElementById('root')

  if (applicationModalLockCount === 0) {
    applicationRoot = root
    originalRootAriaHidden = root?.getAttribute('aria-hidden') ?? null
    rootWasInert = root?.hasAttribute('inert') ?? false
  }
  applicationModalLockCount += 1
  root?.setAttribute('aria-hidden', 'true')
  root?.setAttribute('inert', '')
  let released = false

  return () => {
    if (released) return
    released = true
    applicationModalLockCount = Math.max(0, applicationModalLockCount - 1)
    if (applicationModalLockCount === 0) {
      if (originalRootAriaHidden === null) applicationRoot?.removeAttribute('aria-hidden')
      else applicationRoot?.setAttribute('aria-hidden', originalRootAriaHidden)
      if (!rootWasInert) applicationRoot?.removeAttribute('inert')
      applicationRoot = null
      originalRootAriaHidden = null
      rootWasInert = false
    }
    releaseBodyScroll()
  }
}
