import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionMenu } from './ActionMenu'

afterEach(() => vi.unstubAllGlobals())

describe('ActionMenu', () => {
  it('renders menu content in a body portal and closes with Escape', async () => {
    const user = userEvent.setup()
    render(<ActionMenu label="Open actions"><button type="button" role="menuitem">View profile</button></ActionMenu>)

    const trigger = screen.getByRole('button', { name: 'Open actions' })
    await user.click(trigger)

    const menu = screen.getByRole('menu')
    expect(menu.parentElement).toBe(document.body)
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'View profile' })).toHaveFocus())
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')

    expect(trigger).toHaveFocus()
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('mounts the hover menu closed before playing the fan-out entrance', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true }) as MediaQueryList))
    render(<ActionMenu label="Open actions"><button type="button" role="menuitem">View profile</button></ActionMenu>)

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Open actions' }))

    expect(screen.getByRole('menu')).toHaveAttribute('data-open', 'false')
    await waitFor(() => expect(screen.getByRole('menu')).toHaveAttribute('data-open', 'true'))
  })

  it('keeps a hover-opened menu stable when the pointer returns to the trigger', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true }) as MediaQueryList))
    render(<ActionMenu label="Open actions"><button type="button" role="menuitem">View profile</button></ActionMenu>)

    const trigger = screen.getByRole('button', { name: 'Open actions' })
    fireEvent.mouseEnter(trigger, { clientX: 20, clientY: 20 })
    await waitFor(() => expect(screen.getByRole('menu')).toHaveAttribute('data-open', 'true'))

    fireEvent.mouseLeave(trigger, { clientX: 22, clientY: 20 })
    fireEvent.mouseEnter(trigger, { clientX: 22, clientY: 20 })
    await new Promise((resolve) => window.setTimeout(resolve, 360))

    expect(screen.getByRole('menu')).toHaveAttribute('data-open', 'true')
  })

  it('closes the previous row when another action menu opens', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true }) as MediaQueryList))
    render(<>
      <ActionMenu label="First actions"><button type="button" role="menuitem">First item</button></ActionMenu>
      <ActionMenu label="Second actions"><button type="button" role="menuitem">Second item</button></ActionMenu>
    </>)

    const firstTrigger = screen.getByRole('button', { name: 'First actions' })
    const secondTrigger = screen.getByRole('button', { name: 'Second actions' })

    fireEvent.mouseEnter(firstTrigger, { clientX: 20, clientY: 20 })
    await waitFor(() => expect(firstTrigger).toHaveAttribute('aria-expanded', 'true'))

    fireEvent.mouseEnter(secondTrigger, { clientX: 20, clientY: 72 })
    await waitFor(() => {
      expect(firstTrigger).toHaveAttribute('aria-expanded', 'false')
      expect(secondTrigger).toHaveAttribute('aria-expanded', 'true')
      expect(document.querySelectorAll('.action-menu__content--portal[data-open="true"]')).toHaveLength(1)
    })
  })

  it('preserves semantic tones on portaled action items', async () => {
    const user = userEvent.setup()
    render(<ActionMenu label="Open actions">
      <button type="button" role="menuitem" data-tone="edit">Edit</button>
      <button type="button" role="menuitem" data-tone="danger">Archive</button>
    </ActionMenu>)

    await user.click(screen.getByRole('button', { name: 'Open actions' }))

    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveAttribute('data-tone', 'edit')
    expect(screen.getByRole('menuitem', { name: 'Archive' })).toHaveAttribute('data-tone', 'danger')
  })
})
