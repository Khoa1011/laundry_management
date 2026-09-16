import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { acquireApplicationModalLock, acquireBodyScrollLock } from './overlayLock'

describe('overlay locks', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
    document.body.innerHTML = '<div id="root"></div>'
  })

  afterEach(() => {
    document.body.style.overflow = ''
    document.body.innerHTML = ''
  })

  it('keeps the application inert until the last overlapping modal releases', () => {
    const root = document.getElementById('root')!
    const releaseFirst = acquireApplicationModalLock()
    const releaseSecond = acquireApplicationModalLock()

    releaseFirst()
    expect(root).toHaveAttribute('inert')
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(document.body.style.overflow).toBe('hidden')

    releaseSecond()
    expect(root).not.toHaveAttribute('inert')
    expect(root).not.toHaveAttribute('aria-hidden')
    expect(document.body.style.overflow).toBe('')
  })

  it('does not unlock scrolling while another overlay is still active', () => {
    const releasePanel = acquireBodyScrollLock()
    const releaseModal = acquireApplicationModalLock()

    releasePanel()
    expect(document.body.style.overflow).toBe('hidden')

    releaseModal()
    expect(document.body.style.overflow).toBe('')
  })
})
