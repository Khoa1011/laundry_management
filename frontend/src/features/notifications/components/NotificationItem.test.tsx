import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../../../i18n'
import type { NotificationItem as NotificationItemModel } from '../model/types'
import { NotificationItem } from './NotificationItem'

const mocks = vi.hoisted(() => ({
  markRead: vi.fn(),
  dismiss: vi.fn(),
  notify: vi.fn(),
}))

vi.mock('../../../auth/AuthProvider', () => ({
  useAuth: () => ({ user: { branches: [{ id: 1, name: 'Chi nhĂ¡nh 1' }] } }),
}))
vi.mock('../hooks/useNotifications', () => ({
  useMarkNotificationRead: () => ({ mutateAsync: mocks.markRead, isPending: false }),
  useDismissNotification: () => ({ mutateAsync: mocks.dismiss, isPending: false }),
}))
vi.mock('../../../providers/ToastProvider', () => ({
  useToast: () => ({ notify: mocks.notify }),
}))

const item: NotificationItemModel = {
  id: 41,
  type: 'EMPLOYEE_BRANCH_CHANGED',
  severity: 'INFO',
  titleKey: 'notification.employeeBranchChanged.title',
  messageKey: 'notification.employeeBranchChanged.message',
  titleFallback: 'Branch changed',
  messageFallback: 'Your branch changed',
  metadata: { employeeName: 'A', branchName: 'CN1' },
  branchId: 1,
  referenceType: 'EMPLOYEE',
  referenceId: '7',
  deepLink: '/employees/7',
  createdAt: '2026-07-23T10:00:00Z',
  readAt: null,
  unread: true,
}

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>
}

describe('NotificationItem', () => {
  beforeEach(() => {
    mocks.markRead.mockReset().mockResolvedValue(undefined)
    mocks.dismiss.mockReset().mockResolvedValue(undefined)
    mocks.notify.mockReset()
  })

  it('marks an unread item before navigating to its allowlisted route', async () => {
    const onNavigate = vi.fn()
    render(
      <MemoryRouter>
        <NotificationItem item={item} onNavigate={onNavigate} />
        <LocationProbe />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /Branch changed/i }))

    expect(mocks.markRead).toHaveBeenCalledWith(41)
    expect(onNavigate).toHaveBeenCalledOnce()
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/employees/7')
    })
  })

  it('reports a missing route and supports per-recipient dismissal', async () => {
    render(
      <MemoryRouter>
        <NotificationItem item={{ ...item, deepLink: '/employees/99' }} dismissible />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /Branch changed/i }))
    expect(mocks.markRead).toHaveBeenCalledWith(41)
    expect(mocks.notify).toHaveBeenCalled()

    await userEvent.click(screen.getAllByRole('button')[1])
    expect(mocks.dismiss).toHaveBeenCalledWith(41)
  })
})
