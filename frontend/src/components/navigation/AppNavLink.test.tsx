import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AppNavLink } from './AppNavLink'
import { NAVIGATION_SETTLE_MS, resetNavigationScheduler } from './navigationScheduler'

function LocationProbe() {
  return <output aria-label="Current route">{useLocation().pathname}</output>
}

describe('AppNavLink', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetNavigationScheduler()
  })

  afterEach(() => {
    resetNavigationScheduler()
    vi.useRealTimers()
  })

  it('keeps the first navigation immediate and applies only the latest queued destination', () => {
    render(
      <MemoryRouter initialEntries={['/overview']}>
        <AppNavLink to="/orders" indicatorId="test-indicator">Orders</AppNavLink>
        <AppNavLink to="/customers" indicatorId="test-indicator">Customers</AppNavLink>
        <AppNavLink to="/employees" indicatorId="test-indicator">Employees</AppNavLink>
        <LocationProbe />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('link', { name: 'Orders' }))
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/orders')

    fireEvent.click(screen.getByRole('link', { name: 'Customers' }))
    fireEvent.click(screen.getByRole('link', { name: 'Employees' }))
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/orders')

    act(() => vi.advanceTimersByTime(NAVIGATION_SETTLE_MS))
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/employees')
  })
})
