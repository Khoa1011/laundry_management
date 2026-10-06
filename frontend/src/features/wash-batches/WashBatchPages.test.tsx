import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import type { BatchCandidate, BatchHistory, WashBatch } from './types'
import { candidateCompatibility, quantitiesText, sharingText } from './presentation'
import { WashBatchDetailPage, WashBatchListPage } from './WashBatchPages'

const mocks = vi.hoisted(() => ({
  permissions: new Set<string>(),
  list: vi.fn(), filterOptions: vi.fn(), candidates: vi.fn(), stats: vi.fn(), get: vi.fn(), history: vi.fn(),
  create: vi.fn(), addItems: vi.fn(), removeItems: vi.fn(), updateNote: vi.fn(), markReady: vi.fn(), cancel: vi.fn(),
  notify: vi.fn(), subscribe: vi.fn(),
}))

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ branchId: 1, hasPermission: (code: string) => mocks.permissions.has(code) }),
}))
vi.mock('../../providers/ToastProvider', () => ({ useToast: () => ({ notify: mocks.notify }) }))
vi.mock('../../realtime/context', () => ({ useRealtime: () => ({ connectionState: 'connected', subscribe: mocks.subscribe }) }))
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return { ...actual, washBatchApi: { ...actual.washBatchApi, ...mocks } }
})

const candidate = (overrides: Partial<BatchCandidate> = {}): BatchCandidate => ({
  orderItemId: 11, orderId: 7, orderCode: 'CN01-DH-000007', orderStatus: 'RECEIVED',
  customerName: 'Trần Thị Mai', customerPhone: '0903 123 456', serviceId: 2,
  serviceCode: 'WASH', serviceName: 'Giặt thường', itemTypeId: 3, itemTypeCode: 'SHIRT',
  itemTypeName: 'Áo sơ mi', sharingMode: 'SHARED_STANDARD', quantity: 3.5, unitType: 'KG',
  promisedAt: '2026-09-18T10:00:00Z', orderCreatedAt: '2026-09-17T10:00:00Z', warnings: [],
  ...overrides,
})

const batch: WashBatch = {
  id: 5, batchCode: 'CN01-MG-000005', branch: { id: 1, code: 'CN01', name: 'Chi nhánh chính' },
  service: { id: 2, code: 'WASH', name: 'Giặt thường' }, status: 'DRAFT', note: '', version: 0,
  summary: { orderCount: 1, itemCount: 1, quantities: [{ unitType: 'KG', quantity: 3.5 }] },
  items: [{ batchItemId: 21, active: true, addedAt: '2026-09-17T10:00:00Z', addedBy: { id: 1, displayName: 'Admin' }, ...candidate() }],
  warnings: [], createdAt: '2026-09-17T10:00:00Z', createdBy: { id: 1, displayName: 'Admin' },
  updatedAt: '2026-09-17T10:00:00Z', updatedBy: { id: 1, displayName: 'Admin' },
}

function renderAt(path: string, element: React.ReactNode, pattern = '*') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path={pattern} element={element} /></Routes></MemoryRouter></QueryClientProvider>)
}

describe('Wash batch operational UI', () => {
  beforeEach(() => {
    mocks.permissions.clear()
    Object.values(mocks).forEach((value) => { if (typeof value === 'function' && 'mockReset' in value) value.mockReset() })
    mocks.subscribe.mockReturnValue(() => undefined)
    mocks.stats.mockResolvedValue({ candidateCount: 1, draftCount: 1, readyCount: 0 })
    mocks.filterOptions.mockResolvedValue({ services: [{ id: 2, label: 'Giặt thường' }], creators: [{ id: 1, label: 'Admin' }] })
    mocks.candidates.mockResolvedValue({ items: [candidate()], page: 0, size: 50, totalElements: 1, totalPages: 1 })
    mocks.list.mockResolvedValue({ items: [], page: 0, size: 50, totalElements: 0, totalPages: 0 })
    mocks.get.mockResolvedValue(batch)
    mocks.history.mockResolvedValue([])
    mocks.create.mockResolvedValue(batch)
    mocks.addItems.mockResolvedValue(batch)
    mocks.removeItems.mockResolvedValue(batch)
    mocks.updateNote.mockResolvedValue(batch)
    mocks.markReady.mockResolvedValue({ ...batch, status: 'READY', version: 1 })
    mocks.cancel.mockResolvedValue({ ...batch, status: 'CANCELLED', version: 1 })
  })

  it('opens as a monitoring board for created batches instead of a second composition queue', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_READ)
    mocks.list.mockResolvedValue({ items: [{
      id: 5, batchCode: 'CN01-MG-000005', serviceName: 'Giặt thường', status: 'DRAFT',
      orderCount: 2, itemCount: 3, quantities: [{ unitType: 'KG', quantity: 5.5 }], privateLoad: false, warnings: [],
      createdAt: '2026-09-17T10:00:00Z', createdBy: { id: 1, displayName: 'Admin' },
    }], page: 0, size: 50, totalElements: 1, totalPages: 1 })
    const { container } = renderAt('/wash-batches', <WashBatchListPage />)
    expect(await screen.findAllByText('CN01-MG-000005')).toHaveLength(2)
    expect(screen.getByRole('tab', { name: /Tất cả/ })).toHaveAttribute('aria-selected', 'true')
    expect(container.querySelector('.operational-list')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Xem' })[0]).toHaveClass('batch-list-table__view-button')
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ status: undefined, size: 10 }))
    expect(screen.queryByRole('tab', { name: /Đồ chờ ghép/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Tạo mẻ/i })).not.toBeInTheDocument()
  })

  it('switches between operational statuses using one batch-list data flow', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_READ)
    renderAt('/wash-batches', <WashBatchListPage />)
    await screen.findByText('Chưa có mẻ giặt')
    await userEvent.click(screen.getByRole('tab', { name: /^Sẵn sàng/ }))
    await waitFor(() => expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'READY' })))
    await userEvent.click(screen.getByRole('tab', { name: /^Đang xử lý/ }))
    await waitFor(() => expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'PROCESSING' })))
    expect(document.querySelectorAll('.operational-status-tabs__count--placeholder')).toHaveLength(2)
  })

  it('supports current-page selection without exposing unsupported bulk mutations', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_READ)
    mocks.permissions.add(PERMISSION_CODES.BATCH_CANCEL)
    mocks.list.mockResolvedValue({ items: [{
      id: 5, batchCode: 'CN01-MG-000005', serviceName: 'Giặt thường', status: 'DRAFT', orderCount: 1, itemCount: 1,
      quantities: [{ unitType: 'KG', quantity: 3.5 }], privateLoad: false, warnings: [],
      createdAt: '2026-09-17T10:00:00Z', createdBy: { id: 1, displayName: 'Admin' }, version: 0,
    }], page: 0, size: 10, totalElements: 1, totalPages: 1 })
    renderAt('/wash-batches', <WashBatchListPage />)

    await userEvent.click((await screen.findAllByRole('checkbox', { name: 'Chọn CN01-MG-000005' }))[0])
    expect(screen.getByRole('region', { name: 'Thao tác với 1 mẻ giặt đã chọn' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hủy 1 mẻ/ })).not.toBeInTheDocument()
  })

  it('applies operational filters and pages through the server result', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_READ)
    mocks.list.mockResolvedValue({ items: [{
      id: 5, batchCode: 'CN01-MG-000005', serviceName: 'Giặt thường', status: 'DRAFT', orderCount: 1, itemCount: 1,
      quantities: [{ unitType: 'KG', quantity: 3.5 }], privateLoad: true, warnings: ['ITEM_NOTE_PRESENT'],
      createdAt: '2026-09-17T10:00:00Z', createdBy: { id: 1, displayName: 'Admin' }, version: 0,
    }], page: 0, size: 20, totalElements: 21, totalPages: 2 })
    renderAt('/wash-batches', <WashBatchListPage />)
    await userEvent.click(screen.getByRole('button', { name: /Mở bộ lọc/ }))
    await userEvent.selectOptions(screen.getByLabelText('Dịch vụ'), '2')
    await userEvent.selectOptions(screen.getByLabelText('Loại tải'), 'PRIVATE')
    await userEvent.selectOptions(screen.getByLabelText('Cần kiểm tra'), 'ITEM_NOTE_PRESENT')
    await waitFor(() => expect(mocks.list.mock.calls.some(([params]) => params.serviceId === 2 && params.loadType === 'PRIVATE'
      && params.warning === 'ITEM_NOTE_PRESENT' && params.page === 0 && params.size === 10)).toBe(true))
    expect(screen.getAllByText('Giặt riêng').length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() => expect(mocks.list.mock.calls.some(([params]) => params.page === 1)).toBe(true))
  })

  it('guards detail actions independently by effective permissions', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_READ)
    mocks.permissions.add(PERMISSION_CODES.BATCH_MARK_READY)
    renderAt('/wash-batches/5', <WashBatchDetailPage />, '/wash-batches/:batchId')
    expect(await screen.findByRole('button', { name: 'Đánh dấu sẵn sàng' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thêm đồ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hủy mẻ' })).not.toBeInTheDocument()
    expect(screen.queryByText('Lịch sử mẻ')).not.toBeInTheDocument()
  })

  it('blocks different services and private-load cross-order selection while preserving soft warnings', () => {
    expect(candidateCompatibility(candidate({ serviceId: 9 }), [candidate()])).toEqual({ kind: 'blocked', reasons: ['DIFFERENT_SERVICE'] })
    expect(candidateCompatibility(candidate({ orderItemId: 12, orderId: 8 }), [candidate({ sharingMode: 'PRIVATE_LOAD' })]))
      .toEqual({ kind: 'blocked', reasons: ['PRIVATE_LOAD_CONFLICT'] })
    expect(candidateCompatibility(candidate({ warnings: ['ITEM_NOTE_PRESENT'] }), [])).toEqual({ kind: 'warning', reasons: ['ITEM_NOTE_PRESENT'] })
  })

  it('groups detail items by order, shows item notes, and prevents removing the final item', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_READ)
    mocks.permissions.add(PERMISSION_CODES.BATCH_UPDATE)
    mocks.get.mockResolvedValue({ ...batch, items: [{ ...batch.items[0], itemNote: 'Không dùng nước xả' }] })
    renderAt('/wash-batches/5', <WashBatchDetailPage />, '/wash-batches/:batchId')
    expect(await screen.findByText(/Ghi chú xử lý: Không dùng nước xả/)).toBeInTheDocument()
    expect(screen.getByText(/Mẻ phải còn ít nhất 1 món/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xóa khỏi mẻ' })).not.toBeInTheDocument()
  })

  it('allows removing from a multi-item draft but keeps ready composition read-only', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_READ)
    mocks.permissions.add(PERMISSION_CODES.BATCH_UPDATE)
    const second = { ...batch.items[0], batchItemId: 22, orderItemId: 12, orderId: 8, orderCode: 'CN01-DH-000008' }
    mocks.get.mockResolvedValue({ ...batch, summary: { ...batch.summary, orderCount: 2, itemCount: 2 }, items: [batch.items[0], second] })
    const firstRender = renderAt('/wash-batches/5', <WashBatchDetailPage />, '/wash-batches/:batchId')
    const itemMenus = await screen.findAllByRole('button', { name: 'Thao tác cho Áo sơ mi' })
    expect(itemMenus).toHaveLength(2)
    await userEvent.click(itemMenus[1])
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Xóa khỏi mẻ' }))
    await waitFor(() => expect(mocks.removeItems).toHaveBeenCalledWith(5, 1, 0, [12]))
    firstRender.unmount()

    mocks.get.mockResolvedValue({ ...batch, status: 'READY' })
    renderAt('/wash-batches/5', <WashBatchDetailPage />, '/wash-batches/:batchId')
    expect(await screen.findByText('Mẻ đã sẵn sàng để đưa vào máy.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thêm đồ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xóa khỏi mẻ' })).not.toBeInTheDocument()
  })

  it('requires a cancellation reason and sends the trimmed value', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_READ)
    mocks.permissions.add(PERMISSION_CODES.BATCH_CANCEL)
    renderAt('/wash-batches/5', <WashBatchDetailPage />, '/wash-batches/:batchId')
    await userEvent.click(await screen.findByRole('button', { name: 'Hủy mẻ' }))
    expect(screen.getByRole('button', { name: 'Xác nhận hủy' })).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: 'Lý do hủy' }), '  Đổi lịch vận hành  ')
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy' }))
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith(5, 1, 0, 'Đổi lịch vận hành'))
  })

  it('marks an active editor stale on realtime and handles a 409 without overwriting edits', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_READ)
    mocks.permissions.add(PERMISSION_CODES.BATCH_UPDATE)
    mocks.updateNote.mockRejectedValue(new ApiError(409, { status: 409, title: 'Conflict', detail: 'stale', errorCode: 'BATCH_VERSION_CONFLICT' }))
    renderAt('/wash-batches/5', <WashBatchDetailPage />, '/wash-batches/:batchId')
    await userEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    const note = screen.getByRole('textbox', { name: 'Nội dung ghi chú' })
    await userEvent.type(note, 'Nội dung đang sửa')
    await waitFor(() => expect(mocks.subscribe.mock.calls.filter(([topic]) => topic === 'batch.').length).toBeGreaterThan(1))
    const realtimeCallback = mocks.subscribe.mock.calls.filter(([topic]) => topic === 'batch.').at(-1)?.[1]
    act(() => realtimeCallback?.({ entityId: 5 }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Mẻ giặt vừa được người khác cập nhật')
    await userEvent.click(screen.getByRole('button', { name: 'Tải dữ liệu mới nhất' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Nội dung ghi chú' }), 'Lưu lỗi')
    await userEvent.click(screen.getByRole('button', { name: 'Lưu ghi chú' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Mẻ giặt vừa được người khác cập nhật')
  })

  it('keeps notes in read mode and cancels edits without changing the saved value', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_READ)
    mocks.permissions.add(PERMISSION_CODES.BATCH_UPDATE)
    mocks.get.mockResolvedValue({ ...batch, note: 'Ghi chú ban đầu' })
    renderAt('/wash-batches/5', <WashBatchDetailPage />, '/wash-batches/:batchId')
    expect(await screen.findByText('Ghi chú ban đầu')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Nội dung ghi chú' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa' }))
    const note = screen.getByRole('textbox', { name: 'Nội dung ghi chú' })
    await userEvent.clear(note)
    await userEvent.type(note, 'Nội dung chưa lưu')
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(screen.getByText('Ghi chú ban đầu')).toBeInTheDocument()
    expect(mocks.updateNote).not.toHaveBeenCalled()
  })

  it('only links orders and exposes customer phone with order.read', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_READ)
    const firstRender = renderAt('/wash-batches/5', <WashBatchDetailPage />, '/wash-batches/:batchId')
    expect(await screen.findByText('CN01-DH-000007')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'CN01-DH-000007' })).not.toBeInTheDocument()
    expect(screen.queryByText(/0903 123 456/)).not.toBeInTheDocument()
    firstRender.unmount()

    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    renderAt('/wash-batches/5', <WashBatchDetailPage />, '/wash-batches/:batchId')
    expect(await screen.findByRole('link', { name: 'CN01-DH-000007' })).toBeInTheDocument()
    expect(screen.getByText(/0903 123 456/)).toBeInTheDocument()
  })

  it('renders Vietnamese history labels and presentation never exposes raw enums or cross-unit sums', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_READ)
    mocks.permissions.add(PERMISSION_CODES.BATCH_AUDIT_READ)
    const history: BatchHistory[] = [{ id: 1, action: 'MARKED_READY', fromStatus: 'DRAFT', toStatus: 'READY', actor: { id: 1, displayName: 'Admin' }, createdAt: '2026-09-17T10:00:00Z' }]
    mocks.history.mockResolvedValue(history)
    renderAt('/wash-batches/5', <WashBatchDetailPage />, '/wash-batches/:batchId')
    expect(await screen.findByText('Đánh dấu sẵn sàng')).toBeInTheDocument()
    expect(screen.queryByText('MARKED_READY')).not.toBeInTheDocument()
    expect(quantitiesText([{ unitType: 'KG', quantity: 3.5 }, { unitType: 'ITEM', quantity: 2 }])).toBe('3,5 KG · 2 MÓN')
    expect(sharingText('PRIVATE_LOAD')).toBe('Giặt riêng')
  })

  it('covers empty and error states without reporting a failed request as empty', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_READ)
    mocks.list.mockResolvedValue({ items: [], page: 0, size: 50, totalElements: 0, totalPages: 0 })
    const empty = renderAt('/wash-batches', <WashBatchListPage />)
    expect(await screen.findByText('Chưa có mẻ giặt')).toBeInTheDocument()
    expect(empty.container.querySelector('.batch-empty-illustration')).toHaveAttribute('src', '/images/wash-batches/wash-batches-empty.png')
    empty.unmount()
    mocks.list.mockRejectedValue(new Error('offline'))
    renderAt('/wash-batches', <WashBatchListPage />)
    expect(await screen.findByText('Không tải được danh sách mẻ')).toBeInTheDocument()
    expect(screen.queryByText('Chưa có mẻ giặt')).not.toBeInTheDocument()
  })
})
