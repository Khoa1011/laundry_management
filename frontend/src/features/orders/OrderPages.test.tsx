import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import type { Order } from './types'
import { OrderCreatePage, OrderDetailPage, OrderListPage } from './OrderPages'

const mocks = vi.hoisted(() => ({
  permissions: new Set<string>(),
  list: vi.fn(), get: vi.fn(), history: vi.fn(), services: vi.fn(),
  customers: vi.fn(), preview: vi.fn(), eligibility: vi.fn(),
  create: vi.fn(), transition: vi.fn(), reasoned: vi.fn(),
}))

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ branchId: 1, hasPermission: (code: string) => mocks.permissions.has(code) }),
}))
vi.mock('../../providers/ToastProvider', () => ({ useToast: () => ({ notify: vi.fn() }) }))
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return { ...actual, orderApi: { ...actual.orderApi, ...mocks } }
})

const order: Order = {
  id: 7, orderCode: 'CN01-DH-000007', branchId: 1, branchCode: 'CN01',
  customerName: 'Trần Thị Mai', customerPhone: '0903 123 456', status: 'READY',
  currency: 'VND', totalAmount: 85000, items: [{
    id: 1, serviceId: 2, serviceCode: 'WASH', serviceName: 'Giặt thường',
    pricingMethod: 'BY_WEIGHT', unitType: 'KG', sharingMode: 'ANY', quantity: 3.5,
    billableQuantity: 3.5, lineAmount: 85000, pricingSnapshot: {}, quotedAt: '2026-09-09T10:00:00Z',
  }], createdAt: '2026-09-09T10:00:00Z', createdBy: { id: 1, displayName: 'Nhân viên A' },
  updatedAt: '2026-09-09T10:10:00Z', updatedBy: { id: 1, displayName: 'Nhân viên A' }, version: 2,
}

function renderAt(path: string, element: React.ReactNode, pattern = '*') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path={pattern} element={element} /></Routes></MemoryRouter></QueryClientProvider>)
}

describe('Order pages', () => {
  beforeEach(() => {
    mocks.permissions.clear()
    Object.values(mocks).forEach((value) => { if (typeof value === 'function' && 'mockReset' in value) value.mockReset() })
    mocks.list.mockResolvedValue({ items: [{
      id: order.id, orderCode: order.orderCode, customerName: order.customerName,
      customerPhone: order.customerPhone, serviceSummary: 'Giặt thường', totalAmount: order.totalAmount,
      currency: 'VND', status: order.status, createdAt: order.createdAt, version: order.version,
    }], page: 0, size: 20, totalElements: 1, totalPages: 1 })
    mocks.get.mockResolvedValue(order)
    mocks.history.mockResolvedValue([])
    mocks.services.mockResolvedValue({ items: [{ id: 2, code: 'WASH', nameVi: 'Giặt sấy thường' }] })
    mocks.customers.mockResolvedValue([])
  })

  it('renders touch cards and desktop table from one result set with full phone', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    const { container } = renderAt('/orders', <OrderListPage />)
    expect(await screen.findAllByText('CN01-DH-000007')).toHaveLength(2)
    expect(container.querySelector('.orders-page')).toHaveClass('page-container')
    expect(screen.getAllByText('0903 123 456')).toHaveLength(2)
    expect(screen.queryByRole('link', { name: /Tạo đơn hàng/i })).not.toBeInTheDocument()
  })

  it('explains guest persistence and exposes Vietnamese processing choices', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_CREATE)
    const { container } = renderAt('/orders/new', <OrderCreatePage />)
    expect(container.querySelector('.order-create')).toHaveClass('page-container')
    await userEvent.click(screen.getByRole('button', { name: 'Khách vãng lai' }))
    expect(screen.getByText(/không tự tạo hồ sơ khách hàng/i)).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: 'Giặt sấy thường' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Giặt riêng mẻ' })).toBeInTheDocument()
  })

  it('shows only semantic actions granted for the current ready state', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    mocks.permissions.add(PERMISSION_CODES.ORDER_COMPLETE)
    const { container } = renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    expect(await screen.findByRole('button', { name: /Hoàn tất đơn/i })).toBeInTheDocument()
    expect(container.querySelector('.order-detail')).toHaveClass('page-container')
    expect(screen.queryByRole('button', { name: 'Hủy đơn' })).not.toBeInTheDocument()
    expect(screen.queryByText('Lịch sử đơn hàng')).not.toBeInTheDocument()
  })
})
