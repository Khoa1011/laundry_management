import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FormEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Button, ButtonLink } from './Button'

describe('Button', () => {
  it('exposes the shared create treatment without changing its accessible name', () => {
    render(<Button variant="create">Add customer</Button>)

    expect(screen.getByRole('button', { name: 'Add customer' })).toHaveClass('button--create')
  })

  it('preserves click and native submit behavior', async () => {
    const user = userEvent.setup()
    const submit = vi.fn((event: FormEvent) => event.preventDefault())
    render(<form onSubmit={submit}><Button type="submit">Save</Button></form>)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(submit).toHaveBeenCalledOnce()
  })

  it('blocks click while disabled or loading and exposes loading state', async () => {
    const user = userEvent.setup()
    const click = vi.fn()
    const { rerender } = render(<Button disabled onClick={click}>Save</Button>)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(click).not.toHaveBeenCalled()

    rerender(<Button loading loadingLabel="Saving">Save</Button>)
    const loadingButton = screen.getByRole('button', { name: 'Saving' })
    expect(loadingButton).toBeDisabled()
    expect(loadingButton).toHaveAttribute('aria-busy', 'true')
  })

  it('preserves Enter and Space keyboard activation', async () => {
    const user = userEvent.setup()
    const click = vi.fn()
    render(<Button onClick={click}>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    button.focus()

    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(click).toHaveBeenCalledTimes(2)
  })

  it('prevents disabled links from navigating', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ButtonLink to="/target" disabled>Open</ButtonLink></MemoryRouter>)

    const link = screen.getByRole('link', { name: 'Open' })
    await user.click(link)

    expect(link).toHaveAttribute('aria-disabled', 'true')
    expect(link).toHaveAttribute('tabindex', '-1')
  })
})
