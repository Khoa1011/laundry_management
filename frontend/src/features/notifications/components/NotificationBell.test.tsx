import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../../../i18n'
import { NotificationBell } from './NotificationBell'

const mocks = vi.hoisted(() => ({
  notificationContext: vi.fn(),
  hasPermission: vi.fn(() => true),
  markAll: vi.fn(),
  notify: vi.fn(),
}))

vi.mock('../providers/NotificationProvider', () => ({
  useNotificationContext: () => mocks.notificationContext(),
}))
vi.mock('../../../auth/AuthProvider', () => ({
  useAuth: () => ({ hasPermission: mocks.hasPermission, user: { branches: [] } }),
}))
vi.mock('../hooks/useNotifications', () => ({
  useMarkAllNotificationsRead: () => ({ mutateAsync: mocks.markAll, isPending: false }),
  useMarkNotificationRead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDismissNotification: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../../../providers/ToastProvider', () => ({
  useToast: () => ({ notify: mocks.notify }),
}))

describe('NotificationBell', () => {
  beforeEach(() => {
    mocks.notificationContext.mockReturnValue({
      canRead: true,
      recentNotifications: [],
      unreadCount: 120,
      isLoading: false,
      isError: false,
      connectionState: 'connected',
      bellPulse: 1,
      refresh: vi.fn(),
    })
  })

  it('caps the badge at 99+ and opens an accessible notification dialog', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><NotificationBell /></MemoryRouter>)

    const bell = screen.getByRole('button', { name: /120 thông báo chưa đọc/i })
    expect(screen.getByText('99+')).toBeInTheDocument()
    await user.click(bell)
    expect(screen.getByRole('dialog', { name: 'Thông báo' })).toBeInTheDocument()
    expect(screen.getByText('Chưa có thông báo')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Thông báo' })).not.toBeInTheDocument()
    expect(bell).toHaveFocus()
  })

  it('does not render without read-own permission', () => {
    mocks.notificationContext.mockReturnValue({
      ...mocks.notificationContext(),
      canRead: false,
    })
    render(<MemoryRouter><NotificationBell /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /thông báo chưa đọc/i })).not.toBeInTheDocument()
  })
})
