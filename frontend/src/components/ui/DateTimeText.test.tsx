import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DateTimeText } from './DateTimeText'

describe('DateTimeText', () => {
  afterEach(() => vi.useRealTimers())

  it('moves a newly created order from just now to one minute ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T05:00:30Z'))
    render(<DateTimeText value="2026-10-01T05:00:00Z" recent />)

    const time = screen.getByText('Vừa xong')
    expect(time).toHaveAttribute('datetime')
    expect(time).toHaveAttribute('title', '12:00 01/10/2026')

    act(() => vi.advanceTimersByTime(30_050))
    expect(screen.getByText('1 phút trước')).toBeInTheDocument()
  })
})
