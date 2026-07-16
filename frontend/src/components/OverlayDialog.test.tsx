import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OverlayDialog } from './OverlayDialog'

describe('OverlayDialog', () => {
  it('provides dialog semantics and closes with Escape', () => {
    const onClose = vi.fn()
    render(<OverlayDialog open onClose={onClose} title="Test dialog"><button type="button">Focusable action</button></OverlayDialog>)
    expect(screen.getByRole('dialog', { name: 'Test dialog' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not dismiss on backdrop unless explicitly enabled', () => {
    const onClose = vi.fn()
    render(<OverlayDialog open onClose={onClose} title="Protected"><span>Content</span></OverlayDialog>)
    fireEvent.mouseDown(document.querySelector('.overlay')!)
    expect(onClose).not.toHaveBeenCalled()
  })
})
