import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { MoneyInput } from './MoneyInput'

describe('MoneyInput', () => {
  it('shows grouped digits while keeping a canonical value and compact label', async () => {
    function Harness() {
      const [value, setValue] = useState('')
      return <MoneyInput value={value} onValueChange={setValue} label="Lương cơ bản" />
    }
    render(<Harness />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Lương cơ bản' }), '1250000')
    expect(screen.getByRole('textbox', { name: 'Lương cơ bản' })).toHaveValue('1,250,000')
    expect(screen.getByText('1 triệu 250 nghìn đồng')).toBeInTheDocument()
  })
})
