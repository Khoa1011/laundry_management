import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FormEvent } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

afterEach(() => {
  delete document.documentElement.dataset.motionLevel
})

function setControlRect(control: HTMLElement) {
  vi.spyOn(control, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    right: 100,
    bottom: 40,
    left: 0,
    width: 100,
    height: 40,
    toJSON: () => undefined,
  })
}

describe('Button', () => {
  it('preserves click and native submit behavior', async () => {
    const user = userEvent.setup()
    const submit = vi.fn((event: FormEvent) => event.preventDefault())
    render(<form onSubmit={submit}><Button type="submit">Save</Button></form>)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(submit).toHaveBeenCalledOnce()
  })

  it('blocks click feedback while disabled or loading', () => {
    const click = vi.fn()
    const { rerender } = render(<Button disabled onClick={click}>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })

    fireEvent.pointerDown(button, { button: 0, clientX: 10, clientY: 10 })
    fireEvent.click(button)
    expect(click).not.toHaveBeenCalled()
    expect(button.querySelector('.liquid-ripple')).not.toBeInTheDocument()

    rerender(<Button loading loadingLabel="Saving">Save</Button>)
    expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled()
  })

  it('starts pointer feedback at the press position and cleans it after animation', () => {
    render(<Button>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    setControlRect(button)

    fireEvent.pointerDown(button, { button: 0, clientX: 20, clientY: 15 })
    const ripple = button.querySelector<HTMLElement>('.liquid-ripple')

    expect(ripple).toBeInTheDocument()
    expect(ripple?.style.getPropertyValue('--ripple-x')).toBe('20px')
    expect(ripple?.style.getPropertyValue('--ripple-y')).toBe('15px')

    fireEvent.animationEnd(ripple as HTMLElement)
    expect(button.querySelector('.liquid-ripple')).not.toBeInTheDocument()
  })

  it('bounds repeated feedback and removes every ripple on unmount', () => {
    const { unmount } = render(<Button>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    setControlRect(button)

    for (let index = 0; index < 9; index += 1) {
      fireEvent.pointerDown(button, { button: 0, clientX: index + 1, clientY: 10 })
    }

    expect(button.querySelectorAll('.liquid-ripple').length).toBeLessThanOrEqual(4)
    unmount()
    expect(document.querySelector('.liquid-ripple')).not.toBeInTheDocument()
  })

  it('centers keyboard feedback and uses the reduced-motion flash', () => {
    document.documentElement.dataset.motionLevel = 'reduced'
    render(<Button>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    setControlRect(button)

    fireEvent.keyDown(button, { key: 'Enter' })
    const ripple = button.querySelector<HTMLElement>('.liquid-ripple')

    expect(ripple).toHaveClass('liquid-ripple--reduced')
    expect(ripple?.style.getPropertyValue('--ripple-x')).toBe('50px')
    expect(ripple?.style.getPropertyValue('--ripple-y')).toBe('20px')
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

  it('disables decorative feedback when motion is off', () => {
    document.documentElement.dataset.motionLevel = 'off'
    render(<Button>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    setControlRect(button)

    fireEvent.pointerDown(button, { button: 0, clientX: 20, clientY: 15 })
    fireEvent.keyDown(button, { key: 'Enter' })

    expect(button.querySelector('.liquid-ripple')).not.toBeInTheDocument()
  })
})
