import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { ThemeProvider } from '../../providers/ThemeProvider'
import { ToastProvider } from '../../providers/ToastProvider'
import { AppearanceSettingsPage } from './AppearanceSettingsPage'

describe('AppearanceSettingsPage', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
  })

  it('previews, cancels, and explicitly applies motion preferences', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ThemeProvider>
        <ToastProvider>
          <AppearanceSettingsPage />
        </ToastProvider>
      </ThemeProvider>,
    )

    expect(container.firstElementChild).toHaveClass('page-container', 'appearance-page')

    await user.click(screen.getByRole('radio', { name: 'Reduced' }))
    expect(document.documentElement.dataset.motionLevel).toBe('reduced')
    expect(localStorage.getItem('laundry.ui.motionLevel')).toBeNull()
    expect(screen.getByText(/Changes have not been saved/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel preview' }))
    expect(document.documentElement.dataset.motionLevel).toBe('balanced')
    expect(screen.getByRole('radio', { name: 'Balanced' })).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('radio', { name: 'Off' }))
    await user.click(screen.getByRole('button', { name: 'Apply changes' }))

    expect(localStorage.getItem('laundry.ui.motionLevel')).toBe('off')
    expect(document.documentElement.dataset.motionLevel).toBe('off')
    expect(screen.getAllByText(/settings were applied/i)).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled()
  })
})
