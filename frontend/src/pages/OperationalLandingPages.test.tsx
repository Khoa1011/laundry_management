import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_CODES, type PermissionCode } from '../auth/permissionCodes.generated'
import { MorePage, OrdersUnavailablePage, OverviewPage } from './OperationalLandingPages'

const fixtures = vi.hoisted(() => ({ granted: [] as PermissionCode[] }))

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ hasPermission: (permission: PermissionCode) => fixtures.granted.includes(permission) }),
}))

describe('operational landing pages', () => {
  beforeEach(() => {
    fixtures.granted = []
  })

  it('shows only modules allowed by effective permissions', () => {
    fixtures.granted = [PERMISSION_CODES.CUSTOMER_READ]
    render(<MemoryRouter><OverviewPage /></MemoryRouter>)

    expect(screen.getByRole('link', { name: /Khách hàng/ })).toHaveAttribute('href', '/customers')
    expect(screen.queryByRole('link', { name: /Nhân viên/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Phân quyền/ })).not.toBeInTheDocument()
  })

  it('keeps personal settings available and permission-gates notifications', () => {
    fixtures.granted = [PERMISSION_CODES.NOTIFICATION_READ_OWN]
    render(<MemoryRouter><MorePage /></MemoryRouter>)

    expect(screen.getByRole('link', { name: /Thông báo/ })).toHaveAttribute('href', '/notifications')
    expect(screen.getByRole('link', { name: /Giao diện/ })).toHaveAttribute('href', '/settings/preferences')
  })

  it('does not present fabricated order data', () => {
    render(<OrdersUnavailablePage />)

    expect(screen.getByText('Đơn hàng đang được hoàn thiện')).toBeInTheDocument()
    expect(screen.getByText(/chưa hiển thị dữ liệu mẫu/i)).toBeInTheDocument()
  })
})
