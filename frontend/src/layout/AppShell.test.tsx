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
      displayName: 'Administrator name only',
      roles: ['ADMIN'],
      branches: [],
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
})
