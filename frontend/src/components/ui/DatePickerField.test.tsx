import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DatePickerField } from './DatePickerField'

describe('DatePickerField', () => {
  it('offers date-only quick choices without a browser date-time input', async () => {
    const onChange = vi.fn()
    const { container } = render(<DatePickerField label="Ngày hẹn trả" value="" onChange={onChange} />)

    expect(container.querySelector('input[type="datetime-local"]')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ngày mai' }))

    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })

  it('opens an accessible calendar and confirms the selected date', async () => {
    const onChange = vi.fn()
    render(<DatePickerField label="Ngày hẹn trả" value="2026-09-18" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ngày hẹn trả' }))
    expect(screen.getByRole('dialog', { name: 'Chọn ngày hẹn trả' })).toBeInTheDocument()
    expect(screen.getByText('Chỉ chọn ngày, không cần chọn giờ.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Chọn ngày' }))

    expect(onChange).toHaveBeenCalledWith('2026-09-18')
  })
})
