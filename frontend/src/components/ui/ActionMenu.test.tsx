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
})
