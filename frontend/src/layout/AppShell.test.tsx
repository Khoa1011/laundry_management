import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSION_CODES } from '../auth/permissionCodes.generated'
import { AppShell } from './AppShell'

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
}))

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: 'administrator',
      displayName: 'Administrator name only',
      roles: ['ADMIN'],
      permissions: [],
      branches: [{ id: 1, code: 'MAIN', name: 'Chi nhánh chính' }],
      defaultBranchId: 1,
    },
    branchId: null,
    setBranchId: vi.fn(),
    logout: vi.fn(),
    hasPermission: mocks.hasPermission,
  }),
}))
vi.mock('../features/customers/QuickCustomerDialog', () => ({
  QuickCustomerDialog: () => null,
}))
vi.mock('../features/notifications/components/NotificationBell', () => ({
  NotificationBell: () => null,
}))

describe('AppShell permission visibility', () => {
  it('uses effective permissions and never a role-name bypass', () => {
    mocks.hasPermission.mockImplementation(
      (permission: string) => permission === PERMISSION_CODES.EMPLOYEE_READ_SELF,
    )
    const { container } = render(
      <MemoryRouter initialEntries={['/overview']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/overview" element={<div>Overview</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(container.querySelector('.desktop-sidebar a[href="/customers"]')).not.toBeInTheDocument()
    expect(container.querySelector('.desktop-sidebar a[href="/settings/access"]')).not.toBeInTheDocument()
    expect(container.querySelector('.desktop-sidebar a[href="/employees/me"]')).toBeInTheDocument()
    expect(mocks.hasPermission).toHaveBeenCalledWith(PERMISSION_CODES.CUSTOMER_READ)
  })

  it('renders the shared desktop shell controls and icon tiles', () => {
    mocks.hasPermission.mockReturnValue(false)
    const { container } = render(
      <MemoryRouter initialEntries={['/overview']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/overview" element={<div>Overview</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(container.querySelector('.desktop-sidebar .brand__mark--laundry')).toBeInTheDocument()
    expect(container.querySelectorAll('.desktop-sidebar .nav-item__icon-tile').length).toBeGreaterThan(0)
    expect(container.querySelector('.app-header .header-select__icon')).toBeInTheDocument()
    expect(container.querySelector('.app-header .header-appearance-button')).toBeInTheDocument()
    expect(container.querySelector('.app-header .user-context')).toBeInTheDocument()
    const logoutButton = container.querySelector<HTMLButtonElement>('.app-header .header-logout-button')
    expect(logoutButton).toBeInTheDocument()
    expect(logoutButton?.querySelector('svg')).toBeInTheDocument()
    expect(logoutButton).toHaveAttribute('aria-label')
    expect(logoutButton).toHaveAttribute('title', logoutButton?.getAttribute('aria-label'))
  })
})
