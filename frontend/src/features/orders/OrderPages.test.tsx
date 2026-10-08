import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { ApiError } from '../../api/client'
import type { Order } from './types'
import { OrderCreatePage, OrderDetailPage, OrderListPage } from './OrderPages'
import { promisedDateKey } from '../../utils/promisedDate'
import type { BatchCandidate } from '../wash-batches/types'

const mocks = vi.hoisted(() => ({
  permissions: new Set<string>(),
  list: vi.fn(), filterOptions: vi.fn(), get: vi.fn(), history: vi.fn(), services: vi.fn(),
  customers: vi.fn(), scan: vi.fn(), preview: vi.fn(), eligibility: vi.fn(), requestBagPrint: vi.fn(), addBag: vi.fn(), voidBag: vi.fn(),
  create: vi.fn(), update: vi.fn(), transition: vi.fn(), reasoned: vi.fn(),
  batchCandidates: vi.fn(), batchCreate: vi.fn(), batchByOrder: vi.fn(),
  notify: vi.fn(),
  subscribe: vi.fn(),
  subscriptions: [] as Array<{ prefix: string; listener: (event: { entityId?: number; type: string }) => void }>,
}))

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ branchId: 1, hasPermission: (code: string) => mocks.permissions.has(code) }),
}))
vi.mock('../../providers/ToastProvider', () => ({ useToast: () => ({ notify: mocks.notify }) }))
vi.mock('../../realtime/context', () => ({ useRealtime: () => ({ connectionState: 'connected', subscribe: mocks.subscribe }) }))
vi.mock('../customers/QuickCustomerDialog', () => ({ QuickCustomerDialog: ({ open, onCreated, onClose }: {
  open: boolean; onCreated: (customer: { id: number; customerCode: string; fullName: string; phone: string }) => void; onClose: () => void
}) => open ? <div role="dialog" aria-label="Tạo nhanh khách hàng"><button type="button" onClick={() => { onCreated({ id: 31, customerCode: 'KH-001', fullName: 'Khách vừa tạo', phone: '0901234567' }); onClose() }}>Lưu khách kiểm thử</button></div> : null }))
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return { ...actual, orderApi: { ...actual.orderApi, ...mocks } }
})
vi.mock('../wash-batches/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../wash-batches/api')>()
  return {
    ...actual,
    washBatchApi: {
      ...actual.washBatchApi,
      candidates: mocks.batchCandidates,
      create: mocks.batchCreate,
      byOrder: mocks.batchByOrder,
    },
  }
})

const batchCandidate = (overrides: Partial<BatchCandidate> = {}): BatchCandidate => ({
  orderItemId: 11, orderId: 7, orderCode: 'CN01-DH-000007', orderStatus: 'RECEIVED',
  customerName: 'Trần Thị Mai', customerPhone: '0903 123 456', serviceId: 2,
  serviceCode: 'WASH', serviceName: 'Giặt thường', itemTypeId: 3, itemTypeCode: 'SHIRT',
  itemTypeName: 'Áo sơ mi', sharingMode: 'SHARED_STANDARD', quantity: 3.5, unitType: 'KG',
  itemNote: 'Không dùng nước xả', promisedAt: '2026-09-18T10:00:00Z',
  orderCreatedAt: '2026-09-17T10:00:00Z', warnings: ['ITEM_NOTE_PRESENT'], ...overrides,
})

const order: Order = {
  id: 7, orderCode: 'CN01-DH-000007', branchId: 1, branchCode: 'CN01',
  customerName: 'Trần Thị Mai', customerPhone: '0903 123 456', status: 'READY',
  currency: 'VND', totalAmount: 85000, items: [{
    id: 1, serviceId: 2, itemTypeId: 3, serviceCode: 'WASH', serviceName: 'Giặt thường', itemTypeCode: 'SHIRT', itemTypeName: 'Áo sơ mi',
    pricingMethod: 'BY_WEIGHT', unitType: 'KG', sharingMode: 'ANY', quantity: 3.5,
    billableQuantity: 3.5, lineAmount: 85000, pricingSnapshot: {}, quotedAt: '2026-09-09T10:00:00Z',
  }], bags: [{ id: 21, bagCode: 'CN01-DH-000007-01', sequenceNumber: 1, status: 'RECEIVED', createdAt: '2026-09-09T10:00:00Z', printRequestCount: 0 }], createdAt: '2026-09-09T10:00:00Z', createdBy: { id: 1, displayName: 'Nhân viên A' },
  updatedAt: '2026-09-09T10:10:00Z', updatedBy: { id: 1, displayName: 'Nhân viên A' }, version: 2,
}

function renderAt(path: string, element: React.ReactNode, pattern = '*') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return { ...render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path={pattern} element={element} /></Routes></MemoryRouter></QueryClientProvider>), client }
}

describe('Order pages', () => {
  beforeEach(() => {
    mocks.permissions.clear()
    mocks.subscriptions.length = 0
    Object.values(mocks).forEach((value) => { if (typeof value === 'function' && 'mockReset' in value) value.mockReset() })
    mocks.list.mockResolvedValue({ items: [{
      id: order.id, orderCode: order.orderCode, customerName: order.customerName,
      customerPhone: order.customerPhone, serviceSummary: 'Giặt thường', totalAmount: order.totalAmount,
      currency: 'VND', status: order.status, createdAt: order.createdAt, version: order.version,
    }], page: 0, size: 20, totalElements: 1, totalPages: 1 })
    mocks.get.mockResolvedValue(order)
    mocks.history.mockResolvedValue([])
    mocks.filterOptions.mockResolvedValue({ services: [{ id: 2, label: 'Giặt sấy thường' }] })
    mocks.services.mockResolvedValue([{ id: 2, code: 'WASH', nameVi: 'Giặt sấy thường', defaultUnitType: 'KG', sharingAllowed: true }])
    mocks.customers.mockResolvedValue([])
    mocks.scan.mockResolvedValue({ type: 'NOT_FOUND' })
    mocks.requestBagPrint.mockResolvedValue({ ...order.bags[0], printRequestCount: 1 })
    mocks.addBag.mockResolvedValue(order)
    mocks.voidBag.mockResolvedValue(order)
    mocks.eligibility.mockResolvedValue([{ id: 3, code: 'SHIRT', nameVi: 'Áo sơ mi', defaultUnitType: 'KG' }])
    mocks.preview.mockResolvedValue({ currency: 'VND', finalAmount: 50000, explanation: 'Giá hệ thống', billableQuantity: 2, unitType: 'KG' })
    mocks.create.mockResolvedValue(order)
    mocks.batchCandidates.mockResolvedValue({ items: [batchCandidate()], page: 0, size: 50, totalElements: 1, totalPages: 1 })
    mocks.batchCreate.mockResolvedValue({ id: 5, batchCode: 'CN01-MG-000005', status: 'DRAFT' })
    mocks.batchByOrder.mockResolvedValue([])
    mocks.update.mockResolvedValue(order)
    mocks.subscribe.mockImplementation((prefix, listener) => {
      const subscription = { prefix, listener }
      mocks.subscriptions.push(subscription)
      return () => { const index = mocks.subscriptions.indexOf(subscription); if (index >= 0) mocks.subscriptions.splice(index, 1) }
    })
  })

  it('renders touch cards and desktop table from one result set with full phone', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    const { container } = renderAt('/orders', <OrderListPage />)
    expect(await screen.findAllByText('CN01-DH-000007')).toHaveLength(2)
    expect(container.querySelector('.orders-page')).toHaveClass('page-container')
    expect(screen.getAllByText('0903 123 456')).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Xem' })[0]).toHaveClass('orders-table__view-button')
    expect(screen.queryByRole('link', { name: /Tạo đơn hàng/i })).not.toBeInTheDocument()
  })

  it('shows the laundry illustration for an empty order list without changing its create action', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    mocks.permissions.add(PERMISSION_CODES.ORDER_CREATE)
    mocks.list.mockResolvedValue({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 })
    const { container } = renderAt('/orders', <OrderListPage />)

    expect(await screen.findByRole('heading', { name: 'Chưa có đơn hàng' })).toBeInTheDocument()
    expect(container.querySelector('.orders-empty-illustration')).toHaveAttribute('src', '/images/wash-batches/wash-batches-empty.png')
    expect(screen.getByRole('link', { name: 'Tạo đơn mới' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tạo đơn hàng' })).toBeInTheDocument()
  })

  it('reserves the count slot when a status query cannot provide every tab count', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    const { container } = renderAt('/orders', <OrderListPage />)
    await screen.findAllByText('CN01-DH-000007')

    await userEvent.click(screen.getByRole('tab', { name: /Đã nhận/ }))

    await waitFor(() => expect(container.querySelectorAll('.operational-status-tabs__count--placeholder')).toHaveLength(5))
    const selectedCount = screen.getByRole('tab', { name: /Đã nhận/ }).querySelector('.operational-status-tabs__count')
    expect(selectedCount).not.toHaveClass('operational-status-tabs__count--placeholder')
    expect(selectedCount).toHaveTextContent('1')
  })

  it('selects only visible rows and exposes item-based batch composition when permitted', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    mocks.permissions.add(PERMISSION_CODES.BATCH_CREATE)
    renderAt('/orders', <OrderListPage />)

    await userEvent.click((await screen.findAllByRole('checkbox', { name: 'Chọn CN01-DH-000007' }))[0])
    expect(screen.getByText('1 đã chọn')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Ghép mẻ' })).toHaveLength(2)
    expect(screen.getByRole('region', { name: 'Thao tác với 1 đơn hàng đã chọn' })).toBeInTheDocument()
  })

  it('exposes batch composition only with the generated batch.create permission', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    const first = renderAt('/orders', <OrderListPage />)
    expect((await screen.findAllByText('CN01-DH-000007')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Ghép mẻ' })).not.toBeInTheDocument()
    first.unmount()

    mocks.permissions.add(PERMISSION_CODES.BATCH_CREATE)
    renderAt('/orders', <OrderListPage />)
    expect(await screen.findByRole('button', { name: 'Ghép mẻ' })).toBeInTheDocument()
  })

  it('keeps selected order items while searching and creates the reviewed draft batch', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    mocks.permissions.add(PERMISSION_CODES.BATCH_CREATE)
    mocks.batchCandidates.mockImplementation(({ search }: { search?: string }) => Promise.resolve({
      items: search ? [batchCandidate({ orderItemId: 12, orderId: 8, orderCode: 'CN01-DH-000008', customerName: 'Lê Hoàng Nam', itemNote: undefined })] : [batchCandidate()],
      page: 0, size: 50, totalElements: 1, totalPages: 1,
    }))
    renderAt('/orders/batching', <OrderListPage />)

    await userEvent.click((await screen.findAllByRole('checkbox', { name: /CN01-DH-000007/ }))[0])
    await userEvent.type(screen.getByPlaceholderText('Mã đơn, tên khách, số điện thoại'), 'Nam')
    expect((await screen.findAllByRole('checkbox', { name: /CN01-DH-000008/ })).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1 món đang chọn/).length).toBeGreaterThan(0)
    expect(screen.getByText(/CN01-DH-000007 · Trần Thị Mai/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Xem lại và tạo mẻ' }))
    expect(await screen.findByRole('heading', { name: 'Xác nhận mẻ giặt' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Lưu mẻ nháp' }))
    await waitFor(() => expect(mocks.batchCreate).toHaveBeenCalledWith({
      branchId: 1, orderItemIds: [11], note: null, markReady: false,
    }))
    expect(mocks.notify).toHaveBeenCalledWith(expect.not.objectContaining({ actionLabel: 'Xem mẻ' }))
  })

  it('scopes the existing batch composer to eligible items from selected orders', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_CREATE)
    renderAt('/orders/batching?orders=7,8,8', <OrderListPage />)

    expect(await screen.findByText('Đang hiển thị đồ đủ điều kiện từ 2 đơn đã chọn.')).toBeInTheDocument()
    await waitFor(() => expect(mocks.batchCandidates).toHaveBeenCalledWith(expect.objectContaining({ orderIds: [7, 8] })))
  })

  it('loads additional candidate pages without losing the current selection', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    mocks.permissions.add(PERMISSION_CODES.BATCH_CREATE)
    mocks.batchCandidates.mockImplementation(({ page = 0 }: { page?: number }) => Promise.resolve(page === 0
      ? { items: [batchCandidate()], page: 0, size: 50, totalElements: 2, totalPages: 2 }
      : { items: [batchCandidate({ orderItemId: 12, orderId: 8, orderCode: 'CN01-DH-000008' })], page: 1, size: 50, totalElements: 2, totalPages: 2 }))
    renderAt('/orders/batching', <OrderListPage />)

    await userEvent.click((await screen.findAllByRole('checkbox', { name: /CN01-DH-000007/ }))[0])
    await userEvent.click(screen.getByRole('button', { name: 'Tải thêm đồ chờ ghép' }))

    expect((await screen.findAllByRole('checkbox', { name: /CN01-DH-000008/ })).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1 món đang chọn/).length).toBeGreaterThan(0)
    expect(screen.getByText(/CN01-DH-000007 · Trần Thị Mai/)).toBeInTheDocument()
    expect(mocks.batchCandidates).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 50 }))
  })

  it('invalidates only order queries when an order realtime event arrives', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    renderAt('/orders', <OrderListPage />)
    await waitFor(() => expect(mocks.list.mock.calls.length).toBeGreaterThanOrEqual(2))
    const callsBeforeEvent = mocks.list.mock.calls.length
    act(() => mocks.subscriptions.filter(item => item.prefix === 'order.').forEach(item => item.listener({ entityId: 7, type: 'order.updated' })))
    await waitFor(() => expect(mocks.list.mock.calls.length).toBeGreaterThan(callsBeforeEvent))
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

  it('shows scanner state and resolves customer, bag, and unknown codes without a global key handler', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_CREATE)
    let resolveCustomer!: (value: unknown) => void
    mocks.scan.mockImplementation((_branchId: number, code: string) => code === 'KH-001'
      ? new Promise(resolve => { resolveCustomer = resolve })
      : code === 'B21' ? Promise.resolve({ type: 'BAG', bagCode: order.bags[0].bagCode }) : Promise.resolve({ type: 'NOT_FOUND' }))
    renderAt('/orders/new', <OrderCreatePage />)
    expect(screen.getByText('Máy quét sẵn sàng')).toBeInTheDocument()
    const scan = screen.getByPlaceholderText('Mã KH, tên hoặc số điện thoại')
    await userEvent.type(scan, 'KH-001{Enter}')
    expect(screen.getByText('Đang tra cứu mã…')).toBeInTheDocument()
    resolveCustomer({ type: 'CUSTOMER', customer: { id: 31, customerCode: 'KH-001', fullName: 'Nguyễn Văn A', phone: '0901234567' } })
    expect(await screen.findByText('Đã nhận mã KH-001')).toBeInTheDocument()
    expect(screen.getAllByText('Nguyễn Văn A').length).toBeGreaterThan(0)
    await userEvent.clear(scan)
    await userEvent.type(scan, 'B21{Enter}')
    expect(await screen.findByText(`Đây là mã túi ${order.bags[0].bagCode}, không phải mã khách hàng.`)).toBeInTheDocument()
    expect(screen.queryByText('Nguyễn Văn A')).not.toBeInTheDocument()
    await userEvent.clear(scan)
    await userEvent.type(scan, 'unknown{Enter}')
    expect(await screen.findByText('Không tìm thấy khách hàng.')).toBeInTheDocument()
  })

  it('edits bag count directly and keeps it in the summary without changing preview inputs', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_CREATE)
    const { container } = renderAt('/orders/new', <OrderCreatePage />)
    const bagCount = screen.getByRole('spinbutton', { name: 'Số túi' })
    expect(bagCount).toHaveValue(1)
    await userEvent.click(screen.getByRole('button', { name: 'Tăng số túi' }))
    expect(bagCount).toHaveValue(2)
    expect(container.querySelector('.order-summary')).toHaveTextContent('Số túi2')
    await userEvent.clear(bagCount)
    await userEvent.type(bagCount, '4')
    expect(bagCount).toHaveValue(4)
    await userEvent.click(screen.getByRole('button', { name: 'Giảm số túi' }))
    expect(bagCount).toHaveValue(3)
    expect(mocks.preview).not.toHaveBeenCalled()
  })

  it('keeps the scan input available after lookup failure', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_CREATE)
    mocks.scan.mockRejectedValue(new Error('offline'))
    renderAt('/orders/new', <OrderCreatePage />)
    const scan = screen.getByPlaceholderText('Mã KH, tên hoặc số điện thoại')
    await userEvent.type(scan, 'KH-404{Enter}')
    expect(await screen.findByText('Lỗi tra cứu. Thử lại.')).toBeInTheDocument()
    expect(scan).toBeEnabled()
  })

  it('auto-selects a quick-created customer without clearing the order draft', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_CREATE)
    mocks.permissions.add(PERMISSION_CODES.CUSTOMER_CREATE)
    renderAt('/orders/new', <OrderCreatePage />)
    await screen.findByRole('option', { name: 'Giặt sấy thường' })
    await userEvent.selectOptions(screen.getByLabelText(/^Dịch vụ/), '2')
    await userEvent.selectOptions(screen.getByLabelText(/^Loại đồ/), '3')
    await userEvent.type(screen.getByRole('textbox', { name: /Ghi chú xử lý/ }), 'Giặt nhẹ')
    await userEvent.click(screen.getByRole('button', { name: 'Tạo nhanh khách hàng' }))
    await userEvent.click(screen.getByRole('button', { name: 'Lưu khách kiểm thử' }))
    expect(screen.getByText('Đã nhận mã KH-001')).toBeInTheDocument()
    expect(screen.getAllByText('Khách vừa tạo').length).toBeGreaterThan(0)
    expect(screen.getByRole('textbox', { name: /Ghi chú xử lý/ })).toHaveValue('Giặt nhẹ')
    expect(screen.getByRole('button', { name: 'Tạo đơn' })).toBeEnabled()
  })

  it('locks the draft during submit and preserves it after a failed request', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_CREATE)
    let rejectCreate!: (reason: Error) => void
    mocks.create.mockImplementation(() => new Promise((_resolve, reject) => { rejectCreate = reject }))
    renderAt('/orders/new', <OrderCreatePage />)
    await userEvent.click(screen.getByRole('button', { name: 'Khách vãng lai' }))
    await userEvent.type(screen.getByLabelText('Tên khách'), 'Khách kiểm thử')
    await userEvent.selectOptions(await screen.findByLabelText(/^Dịch vụ/), '2')
    await userEvent.selectOptions(screen.getByLabelText(/^Loại đồ/), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Tạo đơn' }))
    expect(mocks.create).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Tên khách')).toBeDisabled()
    await userEvent.keyboard('{Enter}')
    expect(mocks.create).toHaveBeenCalledOnce()
    rejectCreate(new Error('unavailable'))
    expect(await screen.findByText('Không thể tạo đơn.')).toBeInTheDocument()
    expect(screen.getByLabelText('Tên khách')).toHaveValue('Khách kiểm thử')
    expect(screen.getByLabelText('Tên khách')).toBeEnabled()
  })

  it('shows generated bags after create, previews a label, and resets for the next customer', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_CREATE)
    mocks.create.mockResolvedValue({ ...order, bags: [order.bags[0], { ...order.bags[0], id: 22, bagCode: 'CN01-DH-000007-02', sequenceNumber: 2 }] })
    renderAt('/orders/new', <OrderCreatePage />)
    await userEvent.click(screen.getByRole('button', { name: 'Khách vãng lai' }))
    await userEvent.type(screen.getByLabelText('Tên khách'), 'Khách kiểm thử')
    await userEvent.selectOptions(await screen.findByLabelText(/^Dịch vụ/), '2')
    await userEvent.selectOptions(screen.getByLabelText(/^Loại đồ/), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Tăng số túi' }))
    await userEvent.click(screen.getByRole('button', { name: 'Tạo đơn' }))
    expect(await screen.findByRole('heading', { name: /Đã tạo đơn CN01-DH-000007/ })).toBeInTheDocument()
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ bagCount: 2 }))
    expect(screen.getByText('CN01-DH-000007-02')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Xem mã' })[0])
    expect(screen.getByRole('dialog')).toHaveTextContent('CN01-DH-000007-01')
    await userEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Đóng' }).at(-1)!)
    await userEvent.click(screen.getByRole('button', { name: /Tiếp nhận khách tiếp theo/ }))
    expect(screen.getByText('Máy quét sẵn sàng')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Số túi' })).toHaveValue(1)
    await waitFor(() => expect(screen.getByPlaceholderText('Mã KH, tên hoặc số điện thoại')).toHaveFocus())
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

  it('shows branch-scoped bags in order detail and sends truthful print requests, including print all and reprint', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    mocks.permissions.add(PERMISSION_CODES.ORDER_BAG_PRINT)
    const second = { ...order.bags[0], id: 22, bagCode: 'CN01-DH-000007-02', sequenceNumber: 2 }
    mocks.get.mockResolvedValue({ ...order, bags: [order.bags[0], second] })
    mocks.requestBagPrint.mockImplementation((_orderId: number, bagId: number) => Promise.resolve({ ...(bagId === 21 ? order.bags[0] : second), printRequestCount: 1 }))
    const print = vi.fn()
    const write = vi.fn()
    const popup = { document: { open: vi.fn(), write, close: vi.fn() }, focus: vi.fn(), print, close: vi.fn() } as unknown as Window
    const open = vi.spyOn(window, 'open').mockReturnValue(popup)
    try {
      renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
      expect(await screen.findByText('CN01-DH-000007-01')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'In tất cả tem' }))
      await waitFor(() => expect(mocks.requestBagPrint).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(print).toHaveBeenCalledOnce())
      expect(write.mock.calls[0][0]).toContain('B21')
      expect(write.mock.calls[0][0]).not.toContain('0903 123 456')
      expect(screen.getAllByText(/Đã gửi lệnh in/)).toHaveLength(2)
      await userEvent.click(screen.getAllByRole('button', { name: 'In lại' })[0])
      await waitFor(() => expect(mocks.requestBagPrint).toHaveBeenCalledTimes(3))
      expect(open).toHaveBeenCalledTimes(2)
    } finally { open.mockRestore() }
  })

  it('does not audit a print when the browser blocks its popup', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    mocks.permissions.add(PERMISSION_CODES.ORDER_BAG_PRINT)
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    try {
      renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
      await userEvent.click(await screen.findByRole('button', { name: 'In tất cả tem' }))
      expect(mocks.requestBagPrint).not.toHaveBeenCalled()
      expect(screen.getByText('In thất bại · Thử lại')).toBeInTheDocument()
      expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' }))
    } finally { open.mockRestore() }
  })

  it('shows add and void controls only for received orders with update permission', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    mocks.permissions.add(PERMISSION_CODES.ORDER_UPDATE)
    mocks.get.mockResolvedValue({ ...order, status: 'RECEIVED', bags: [order.bags[0], { ...order.bags[0], id: 22, bagCode: 'CN01-DH-000007-02', sequenceNumber: 2 }] })
    const { unmount } = renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    expect(await screen.findByRole('button', { name: 'Thêm túi' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Hủy túi' })).toHaveLength(2)
    unmount()
    mocks.permissions.delete(PERMISSION_CODES.ORDER_UPDATE)
    renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    await screen.findByText('CN01-DH-000007-02')
    expect(screen.queryByRole('button', { name: 'Thêm túi' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hủy túi' })).not.toBeInTheDocument()
  })

  it('adds one bag with a locked dialog, then exposes its print action', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    mocks.permissions.add(PERMISSION_CODES.ORDER_UPDATE)
    mocks.permissions.add(PERMISSION_CODES.ORDER_BAG_PRINT)
    const received = { ...order, status: 'RECEIVED' as const }
    const added = { ...received, bags: [...received.bags, { ...received.bags[0], id: 22, bagCode: 'CN01-DH-000007-02', sequenceNumber: 2 }] }
    mocks.get.mockResolvedValue(received)
    let resolveAdd!: (value: Order) => void
    mocks.addBag.mockReturnValue(new Promise<Order>(resolve => { resolveAdd = resolve }))
    renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    await userEvent.click(await screen.findByRole('button', { name: 'Thêm túi' }))
    const dialog = screen.getByRole('dialog', { name: 'Thêm túi mới' })
    expect(dialog).toHaveTextContent('Mã túi đã tạo sẽ không thể đổi')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm túi' }))
    expect(within(dialog).getByRole('button', { name: /Thêm túi/ })).toBeDisabled()
    expect(mocks.addBag).toHaveBeenCalledOnce()
    resolveAdd(added)
    expect(await screen.findByText('CN01-DH-000007-02')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'In tem' })).toHaveLength(2)
  })

  it('requires a reason and retains a voided bag without its print action', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    mocks.permissions.add(PERMISSION_CODES.ORDER_UPDATE)
    mocks.permissions.add(PERMISSION_CODES.ORDER_BAG_PRINT)
    const second = { ...order.bags[0], id: 22, bagCode: 'CN01-DH-000007-02', sequenceNumber: 2 }
    const received = { ...order, status: 'RECEIVED' as const, bags: [order.bags[0], second] }
    mocks.get.mockResolvedValue(received)
    mocks.voidBag.mockResolvedValue({ ...received, bags: [received.bags[0], { ...second, status: 'VOIDED', voidReason: 'Nhập nhầm' }] })
    const { container } = renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    await screen.findByText('CN01-DH-000007-02')
    await userEvent.click(screen.getAllByRole('button', { name: 'Hủy túi' })[1])
    const dialog = screen.getByRole('dialog', { name: 'Hủy túi CN01-DH-000007-02?' })
    expect(within(dialog).getByRole('button', { name: 'Hủy túi' })).toBeDisabled()
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Lý do/ }), 'Nhập nhầm')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy túi' }))
    await waitFor(() => expect(container.querySelectorAll('.order-bags__row--voided')).toHaveLength(1))
    const voidedRow = container.querySelector('.order-bags__row--voided') as HTMLElement
    expect(voidedRow).toHaveTextContent('CN01-DH-000007-02')
    expect(voidedRow).toHaveTextContent('Nhập nhầm')
    expect(within(voidedRow).queryByRole('button', { name: /In tem|In lại/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hủy túi' })).not.toBeInTheDocument()
  })

  it('excludes voided and legacy bags from print all and hides mutation controls in ready state', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    mocks.permissions.add(PERMISSION_CODES.ORDER_UPDATE)
    mocks.permissions.add(PERMISSION_CODES.ORDER_BAG_PRINT)
    mocks.get.mockResolvedValue({ ...order, bags: [order.bags[0],
      { ...order.bags[0], id: 22, bagCode: 'CN01-DH-000007-02', sequenceNumber: 2, status: 'VOIDED', voidReason: 'Sai' },
      { ...order.bags[0], id: 23, bagCode: 'CN01-DH-000007-03', sequenceNumber: 3, status: 'LEGACY_UNVERIFIED' }] })
    const popup = { document: { open: vi.fn(), write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn(), close: vi.fn() } as unknown as Window
    const open = vi.spyOn(window, 'open').mockReturnValue(popup)
    try {
      renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
      expect(await screen.findByText('CN01-DH-000007-03')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Thêm túi' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Hủy túi' })).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'In tất cả tem' }))
      await waitFor(() => expect(mocks.requestBagPrint).toHaveBeenCalledOnce())
      expect(mocks.requestBagPrint).toHaveBeenCalledWith(7, 21, 1)
    } finally { open.mockRestore() }
  })

  it('cannot void the final active bag in UI', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    mocks.permissions.add(PERMISSION_CODES.ORDER_UPDATE)
    mocks.get.mockResolvedValue({ ...order, status: 'RECEIVED' })
    renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    expect(await screen.findByText('Đơn phải còn ít nhất một túi đang nhận.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hủy túi' })).not.toBeInTheDocument()
  })

  it('preserves the reason on stale last-bag validation failure', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    mocks.permissions.add(PERMISSION_CODES.ORDER_UPDATE)
    const second = { ...order.bags[0], id: 22, bagCode: 'CN01-DH-000007-02', sequenceNumber: 2 }
    mocks.get.mockResolvedValue({ ...order, status: 'RECEIVED', bags: [order.bags[0], second] })
    mocks.voidBag.mockRejectedValue(new ApiError(422, { status: 422, title: 'Invalid bag', errorCode: 'ORDER_BAG_LAST_ACTIVE' }))
    const { container } = renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    await screen.findByText('CN01-DH-000007-02')
    await userEvent.click(screen.getAllByRole('button', { name: 'Hủy túi' })[1])
    const dialog = screen.getByRole('dialog', { name: 'Hủy túi CN01-DH-000007-02?' })
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Lý do/ }), 'Nhập nhầm')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy túi' }))
    expect(await within(dialog).findByText('Đơn hàng phải còn ít nhất một túi đang nhận.')).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: /Lý do/ })).toHaveValue('Nhập nhầm')
    expect(container.querySelector('.order-bags__row--voided')).not.toBeInTheDocument()
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

  it('sends an item processing note when creating an order', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_CREATE)
    renderAt('/orders/new', <OrderCreatePage />)
    await userEvent.click(screen.getByRole('button', { name: 'Khách vãng lai' }))
    await userEvent.type(screen.getByLabelText('Tên khách'), 'Khách kiểm thử')
    await userEvent.selectOptions(await screen.findByLabelText(/^Dịch vụ/), '2')
    await userEvent.selectOptions(screen.getByLabelText(/^Loại đồ/), '3')
    await userEvent.type(screen.getByRole('textbox', { name: /Ghi chú xử lý/ }), 'Không dùng nước xả')
    await userEvent.click(screen.getByRole('button', { name: 'Tạo đơn' }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ note: 'Không dùng nước xả' })],
    })))
  })

  it('automatically creates a dedicated draft batch for a private-load order', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_CREATE)
    mocks.permissions.add(PERMISSION_CODES.BATCH_CREATE)
    mocks.create.mockResolvedValue({ ...order, status: 'RECEIVED', items: [{ ...order.items[0], id: 41, sharingMode: 'PRIVATE_LOAD' }] })
    renderAt('/orders/new', <OrderCreatePage />)
    await userEvent.click(screen.getByRole('button', { name: 'Khách vãng lai' }))
    await userEvent.type(screen.getByLabelText('Tên khách'), 'Khách giặt riêng')
    await userEvent.selectOptions(await screen.findByLabelText(/^Dịch vụ/), '2')
    await userEvent.selectOptions(screen.getByLabelText(/^Loại đồ/), '3')
    await userEvent.selectOptions(screen.getByRole('option', { name: 'Giặt riêng mẻ' }).parentElement as HTMLSelectElement, 'PRIVATE_LOAD')

    const batchChoice = screen.getByRole('checkbox', { name: /Tự tạo mẻ nháp riêng/ })
    expect(batchChoice).toBeChecked()
    expect(batchChoice).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Tạo đơn' }))

    await waitFor(() => expect(mocks.batchCreate).toHaveBeenCalledWith({
      branchId: 1,
      orderItemIds: [41],
      note: 'Tạo trực tiếp từ CN01-DH-000007',
      markReady: false,
    }))
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Đã tạo 1 mẻ nháp riêng') }))
  })

  it('keeps a successfully saved order when its requested draft batch fails', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_CREATE)
    mocks.permissions.add(PERMISSION_CODES.BATCH_CREATE)
    mocks.create.mockResolvedValue({ ...order, status: 'RECEIVED', items: [{ ...order.items[0], id: 51 }] })
    mocks.batchCreate.mockRejectedValue(new Error('batch unavailable'))
    renderAt('/orders/new', <OrderCreatePage />)
    await userEvent.click(screen.getByRole('button', { name: 'Khách vãng lai' }))
    await userEvent.type(screen.getByLabelText('Tên khách'), 'Khách kiểm thử')
    await userEvent.selectOptions(await screen.findByLabelText(/^Dịch vụ/), '2')
    await userEvent.selectOptions(screen.getByLabelText(/^Loại đồ/), '3')
    await userEvent.click(screen.getByRole('checkbox', { name: /Tạo mẻ nháp riêng sau khi lưu/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Tạo đơn' }))

    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce())
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({
      tone: 'info', message: expect.stringContaining('đã lưu; 1 mẻ chưa tạo được'),
    }))
  })

  it('creates an order with a promised date and no browser time input', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_CREATE)
    const { container } = renderAt('/orders/new', <OrderCreatePage />)
    expect(container.querySelector('input[type="datetime-local"]')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Khách vãng lai' }))
    await userEvent.type(screen.getByLabelText('Tên khách'), 'Khách kiểm thử')
    await userEvent.selectOptions(await screen.findByLabelText(/^Dịch vụ/), '2')
    await userEvent.selectOptions(screen.getByLabelText(/^Loại đồ/), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Ngày mai' }))
    await userEvent.click(screen.getByRole('button', { name: 'Tạo đơn' }))

    await waitFor(() => expect(mocks.create).toHaveBeenCalled())
    const promisedAt = mocks.create.mock.calls[0][0].promisedAt
    expect(promisedAt).toBeTruthy()
    expect(promisedDateKey(promisedAt)).not.toBe(promisedDateKey(new Date().toISOString()))
    expect(new Date(promisedAt).getHours()).toBe(23)
    expect(new Date(promisedAt).getMinutes()).toBe(59)
  })

  it('does not re-preview when typing an item note on create', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_CREATE)
    renderAt('/orders/new', <OrderCreatePage />)
    await screen.findByRole('option', { name: 'Giặt sấy thường' })
    await userEvent.selectOptions(screen.getByLabelText(/^Dịch vụ/), '2')
    await userEvent.selectOptions(screen.getByLabelText(/^Loại đồ/), '3')
    expect(await screen.findByText('Giá hệ thống')).toBeInTheDocument()
    mocks.preview.mockClear()

    await userEvent.type(screen.getByRole('textbox', { name: /Ghi chú xử lý/ }), 'Không dùng nước xả')
    await act(() => new Promise(resolve => window.setTimeout(resolve, 350)))

    expect(mocks.preview).not.toHaveBeenCalled()
  })

  it('re-previews create pricing when quantity or item type changes', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_CREATE)
    renderAt('/orders/new', <OrderCreatePage />)
    await screen.findByRole('option', { name: 'Giặt sấy thường' })
    await userEvent.selectOptions(screen.getByLabelText(/^Dịch vụ/), '2')
    const itemType = screen.getByLabelText(/^Loại đồ/)
    await userEvent.selectOptions(itemType, '3')
    expect(await screen.findByText('Giá hệ thống')).toBeInTheDocument()
    mocks.preview.mockClear()

    const quantity = screen.getByLabelText(/^Số lượng \/ khối lượng/)
    await userEvent.clear(quantity)
    await userEvent.type(quantity, '3')
    await waitFor(() => expect(mocks.preview).toHaveBeenCalled())
    mocks.preview.mockClear()

    await userEvent.selectOptions(itemType, '')
    await userEvent.selectOptions(itemType, '3')
    await waitFor(() => expect(mocks.preview).toHaveBeenCalled())
  })

  it('renders a note beneath its corresponding order item', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    mocks.get.mockResolvedValue({
      ...order,
      items: [{ ...order.items[0], note: 'Áo trắng có vết mực ở tay áo' }],
    })
    renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    expect(await screen.findByText(/Áo trắng có vết mực ở tay áo/)).toBeInTheDocument()
  })

  it('sends itemNoteUpdates without structural items or preview for a received note-only edit', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_UPDATE)
    const received = {
      ...order,
      status: 'RECEIVED' as const,
      items: [{ ...order.items[0], note: 'Vết cũ' }],
    }
    mocks.get.mockResolvedValue(received)
    mocks.update.mockResolvedValue({ ...received, version: 3 })
    renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    await userEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    const itemNote = screen.getByRole('textbox', { name: /Ghi chú xử lý/ })
    await userEvent.clear(itemNote)
    await userEvent.type(itemNote, 'Không dùng nước xả')
    await act(() => new Promise(resolve => window.setTimeout(resolve, 300)))
    expect(mocks.preview).not.toHaveBeenCalled()
    const save = screen.getByRole('button', { name: 'Lưu thay đổi' })
    await waitFor(() => expect(save).toBeEnabled())
    await userEvent.click(save)
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(7, 1, {
      version: 2, itemNoteUpdates: [{ itemId: 1, note: 'Không dùng nước xả' }],
    }))
    expect(mocks.update.mock.calls[0][2]).not.toHaveProperty('items')
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ message: 'Đã cập nhật ghi chú xử lý.' }))
  })

  it('sends structural items for pricing changes and omits redundant note updates', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_UPDATE)
    const received = { ...order, status: 'RECEIVED' as const, items: [{ ...order.items[0], note: 'Vết cũ' }] }
    mocks.get.mockResolvedValue(received)
    mocks.update.mockResolvedValue({ ...received, version: 3 })
    renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    await userEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    await userEvent.clear(screen.getByLabelText(/^Số lượng \/ khối lượng/))
    await userEvent.type(screen.getByLabelText(/^Số lượng \/ khối lượng/), '4')
    await userEvent.clear(screen.getByRole('textbox', { name: /Ghi chú xử lý/ }))
    await userEvent.type(screen.getByRole('textbox', { name: /Ghi chú xử lý/ }), 'Ghi chú cùng thay đổi giá')
    await waitFor(() => expect(mocks.preview).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() => expect(mocks.update).toHaveBeenCalled())
    const body = mocks.update.mock.calls[0][2]
    expect(body.items).toEqual([expect.objectContaining({ quantity: 4, note: 'Ghi chú cùng thay đổi giá' })])
    expect(body).not.toHaveProperty('itemNoteUpdates')
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ message: 'Đã cập nhật đơn và tính lại giá.' }))
  })

  it('sends structural items for a pricing-only edit', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_UPDATE)
    const received = { ...order, status: 'RECEIVED' as const }
    mocks.get.mockResolvedValue(received)
    mocks.update.mockResolvedValue({ ...received, version: 3 })
    renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    await userEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    const quantity = screen.getByLabelText(/^Số lượng \/ khối lượng/)
    await userEvent.clear(quantity)
    await userEvent.type(quantity, '4')
    await waitFor(() => expect(mocks.preview).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() => expect(mocks.update).toHaveBeenCalled())
    expect(mocks.update.mock.calls[0][2]).toEqual(expect.objectContaining({
      version: 2, items: [expect.objectContaining({ quantity: 4 })],
    }))
    expect(mocks.update.mock.calls[0][2]).not.toHaveProperty('itemNoteUpdates')
  })

  it('allows safe metadata editing in processing without sending structural items', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_UPDATE)
    const processing = { ...order, status: 'PROCESSING' as const }
    mocks.get.mockResolvedValue(processing)
    mocks.update.mockResolvedValue({ ...processing, note: 'Gọi khách trước khi trả', version: 3 })
    renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    await userEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    expect(screen.queryByLabelText('Dịch vụ')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Ghi chú xử lý')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Ghi chú'), 'Gọi khách trước khi trả')
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(mocks.update).toHaveBeenCalledWith(7, 1, expect.objectContaining({
      version: 2, note: 'Gọi khách trước khi trả',
    }))
    expect(mocks.update.mock.calls[0][2]).not.toHaveProperty('items')
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ message: 'Đã cập nhật đơn hàng.' }))
  })

  it('keeps item-note editor hidden in ready state', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_UPDATE)
    mocks.get.mockResolvedValue({ ...order, status: 'READY' as const })
    renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    await userEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    expect(screen.queryByLabelText('Ghi chú xử lý')).not.toBeInTheDocument()
  })

  it('shows a friendly history label for item-note updates', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_AUDIT_READ)
    mocks.history.mockResolvedValue([{
      id: 9, action: 'UPDATED', changedFields: { fields: ['itemNotes'], itemNotes: [{ itemId: 1 }] },
      source: 'MANUAL_COMMAND', actor: { id: 1, displayName: 'Nhân viên A' }, createdAt: order.updatedAt,
    }])
    renderAt('/orders/7', <OrderDetailPage />, '/orders/:orderId')
    expect(await screen.findByText('Cập nhật ghi chú xử lý')).toBeInTheDocument()
    expect(screen.queryByText('itemNotes')).not.toBeInTheDocument()
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
    await userEvent.click(screen.getByRole('button', { name: /Mở bộ lọc/ }))
    await userEvent.type(screen.getByLabelText('Từ ngày'), '2026-09-01')
    await userEvent.type(screen.getByLabelText('Đến ngày'), '2026-09-16')
    await waitFor(() => expect(mocks.list.mock.calls.some(([params]) => params.from === new Date(2026, 8, 1).toISOString()
      && params.to === new Date(2026, 8, 17).toISOString())).toBe(true))
  })

  it('filters orders by service and promised return urgency', async () => {
    renderAt('/orders', <OrderListPage />)
    await userEvent.click(screen.getByRole('button', { name: /Mở bộ lọc/ }))
    await userEvent.selectOptions(await screen.findByLabelText('Dịch vụ'), '2')
    await userEvent.selectOptions(screen.getByLabelText('Hạn trả'), 'NO_DATE')
    await waitFor(() => expect(mocks.list.mock.calls.some(([params]) => params.serviceId === 2 && params.promisedMissing === true)).toBe(true))
  })
})
