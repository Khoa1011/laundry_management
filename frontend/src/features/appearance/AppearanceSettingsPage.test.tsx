import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { ThemeProvider } from '../../providers/ThemeProvider'
import { ToastProvider } from '../../providers/ToastProvider'
import { AppearanceSettingsPage } from './AppearanceSettingsPage'

describe('AppearanceSettingsPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('previews, cancels, and explicitly applies a palette', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ThemeProvider>
        <ToastProvider>
          <AppearanceSettingsPage />
        </ToastProvider>
      </ThemeProvider>,
    )

    expect(container.firstElementChild).toHaveClass('page-container', 'appearance-page')

    await user.click(screen.getByRole('radio', { name: 'Ocean Blue' }))

    expect(document.documentElement.dataset.palette).toBe('ocean-blue')
    expect(localStorage.getItem('laundry.ui.palette')).toBeNull()
    expect(screen.getByText(/Changes have not been saved/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel preview' }))

    expect(document.documentElement.dataset.palette).toBe('laundry-green')
    expect(screen.getByRole('radio', { name: 'Laundry Green' })).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('radio', { name: 'Aqua Teal' }))
    await user.click(screen.getByRole('button', { name: 'Apply changes' }))

    expect(localStorage.getItem('laundry.ui.palette')).toBe('aqua-teal')
    expect(document.documentElement.dataset.palette).toBe('aqua-teal')
    expect(screen.getAllByText(/settings were applied/i)).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled()
  })
})
