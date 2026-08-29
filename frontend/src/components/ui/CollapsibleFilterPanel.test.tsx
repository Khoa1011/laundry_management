import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import '../../i18n'
import { CollapsibleFilterPanel } from './CollapsibleFilterPanel'

describe('CollapsibleFilterPanel', () => {
  it('starts collapsed and toggles its filter controls', async () => {
    const user = userEvent.setup()
    render(
      <CollapsibleFilterPanel label="Bộ lọc" activeCount={2}>
        <label>Trạng thái<select><option>Tất cả</option></select></label>
      </CollapsibleFilterPanel>,
    )

    const toggle = screen.getByRole('button', { name: /Bộ lọc/i })
    const content = screen.getByText('Trạng thái').closest('.collapsible-filter__body')

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(content).toHaveAttribute('aria-hidden', 'true')
    expect(content).toHaveAttribute('inert')
    expect(screen.getByLabelText(/2 bộ lọc đang áp dụng/i)).toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(content).toHaveAttribute('aria-hidden', 'false')
    expect(content).not.toHaveAttribute('inert')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
