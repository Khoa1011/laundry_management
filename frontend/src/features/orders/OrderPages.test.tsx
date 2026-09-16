import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { ApiError } from '../../api/client'
import type { Order } from './types'
import { OrderCreatePage, OrderDetailPage, OrderListPage } from './OrderPages'

const mocks = vi.hoisted(() => ({
  permissions: new Set<string>(),
  list: vi.fn(), get: vi.fn(), history: vi.fn(), services: vi.fn(),
  customers: vi.fn(), preview: vi.fn(), eligibility: vi.fn(),
  create: vi.fn(), update: vi.fn(), transition: vi.fn(), reasoned: vi.fn(),
  subscribe: vi.fn(),
}))

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ branchId: 1, hasPermission: (code: string) => mocks.permissions.has(code) }),
}))
vi.mock('../../providers/ToastProvider', () => ({ useToast: () => ({ notify: vi.fn() }) }))
vi.mock('../../realtime/context', () => ({ useRealtime: () => ({ connectionState: 'connected', subscribe: mocks.subscribe }) }))
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return { ...actual, orderApi: { ...actual.orderApi, ...mocks } }
})

const order: Order = {
  id: 7, orderCode: 'CN01-DH-000007', branchId: 1, branchCode: 'CN01',
  customerName: 'Trần Thị Mai', customerPhone: '0903 123 456', status: 'READY',
  currency: 'VND', totalAmount: 85000, items: [{
    id: 1, serviceId: 2, itemTypeId: 3, serviceCode: 'WASH', serviceName: 'Giặt thường', itemTypeCode: 'SHIRT', itemTypeName: 'Áo sơ mi',
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
    mocks.services.mockResolvedValue([{ id: 2, code: 'WASH', nameVi: 'Giặt sấy thường', defaultUnitType: 'KG', sharingAllowed: true }])
    mocks.customers.mockResolvedValue([])
    mocks.eligibility.mockResolvedValue([{ id: 3, code: 'SHIRT', nameVi: 'Áo sơ mi', defaultUnitType: 'KG' }])
    mocks.preview.mockResolvedValue({ currency: 'VND', finalAmount: 50000, explanation: 'Giá hệ thống', billableQuantity: 2, unitType: 'KG' })
    mocks.update.mockResolvedValue(order)
    mocks.subscribe.mockImplementation(() => () => undefined)
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

  it('requires a concrete item type and uses intake options without catalog permissions', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_CREATE)
    renderAt('/orders/new', <OrderCreatePage />)
    await userEvent.click(screen.getByRole('button', { name: 'Khách vãng lai' }))
    await userEvent.type(screen.getByLabelText('Tên khách'), 'Khách kiểm thử')
    await userEvent.selectOptions(await screen.findByLabelText(/^Dịch vụ/), '2')
    expect(screen.getByRole('button', { name: 'Tạo đơn' })).toBeDisabled()
    expect(mocks.eligibility).toHaveBeenCalledWith(1, 2)
    await userEvent.selectOptions(screen.getByLabelText(/^Loại đồ/), '3')
    expect(await screen.findByText('Giá hệ thống')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tạo đơn' })).toBeEnabled()
  })

  it('allows safe metadata editing in processing without sending structural items', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_UPDATE)
    const processing = { ...order, status: 'PROCESSING' as const }
    mocks.get.mockResolvedValue(processing)
    mocks.update.mockResolvedValue({ ...processing, note: 'Gọi khách trước khi trả', version: 3 })
    renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    await userEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    expect(screen.queryByLabelText('Dịch vụ')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Ghi chú'), 'Gọi khách trước khi trả')
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(mocks.update).toHaveBeenCalledWith(7, 1, expect.objectContaining({
      version: 2, note: 'Gọi khách trước khi trả',
    }))
    expect(mocks.update.mock.calls[0][2]).not.toHaveProperty('items')
  })

  it('keeps unsaved edit input and shows reload action on optimistic conflict', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_UPDATE)
    mocks.get.mockResolvedValue({ ...order, status: 'PROCESSING' as const })
    mocks.update.mockRejectedValue(new ApiError(409, { status: 409, title: 'Order changed', detail: 'Conflict', errorCode: 'ORDER_VERSION_CONFLICT' }))
    renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    await userEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    await userEvent.type(screen.getByLabelText('Ghi chú'), 'Không được mất')
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText('Đơn hàng vừa được người khác cập nhật.')).toBeInTheDocument()
    expect(screen.getByLabelText('Ghi chú')).toHaveValue('Không được mất')
    expect(screen.getByRole('button', { name: /Tải bản mới/i })).toBeInTheDocument()
  })

  it('keeps completed and cancelled orders read only', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_UPDATE)
    mocks.get.mockResolvedValue({ ...order, status: 'COMPLETED' as const })
    const view = renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    expect(await screen.findByText('CN01-DH-000007')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).not.toBeInTheDocument()
    view.unmount()
    mocks.get.mockResolvedValue({ ...order, status: 'CANCELLED' as const })
    renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    expect(await screen.findByText('CN01-DH-000007')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).not.toBeInTheDocument()
  })

  it('sends received date filters to the order list API', async () => {
    renderAt('/orders', <OrderListPage />)
    await userEvent.click(screen.getByText('Lọc theo ngày nhận'))
    await userEvent.type(screen.getByLabelText('Từ ngày'), '2026-09-01')
    await userEvent.type(screen.getByLabelText('Đến ngày'), '2026-09-16')
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({
      from: new Date('2026-09-01T00:00:00').toISOString(),
      to: new Date('2026-09-16T23:59:59.999').toISOString(),
    })))
  })
})
