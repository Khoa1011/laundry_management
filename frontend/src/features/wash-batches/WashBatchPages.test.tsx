import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import type { BatchCandidate, BatchHistory, WashBatch } from './types'
import { candidateCompatibility, quantitiesText, sharingText } from './presentation'
import { WashBatchCreatePage, WashBatchDetailPage, WashBatchListPage } from './WashBatchPages'

const mocks = vi.hoisted(() => ({
  permissions: new Set<string>(),
  list: vi.fn(), candidates: vi.fn(), stats: vi.fn(), get: vi.fn(), history: vi.fn(),
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

function renderCreate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter([
    { path: '/wash-batches/new', element: <WashBatchCreatePage /> },
    { path: '/wash-batches/:batchId', element: <div>Chi tiết vừa tạo</div> },
  ], { initialEntries: ['/wash-batches/new'] })
  return render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
}

describe('Wash batch operational UI', () => {
  beforeEach(() => {
    mocks.permissions.clear()
    Object.values(mocks).forEach((value) => { if (typeof value === 'function' && 'mockReset' in value) value.mockReset() })
    mocks.subscribe.mockReturnValue(() => undefined)
    mocks.stats.mockResolvedValue({ candidateCount: 1, draftCount: 1, readyCount: 0 })
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

  it('renders one candidate result as mobile card and desktop table with the full phone number', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_READ)
    const { container } = renderAt('/wash-batches', <WashBatchListPage />)
    expect(await screen.findAllByText('CN01-DH-000007')).toHaveLength(2)
    expect(screen.getAllByText('0903 123 456')).toHaveLength(2)
    expect(container.querySelector('.batch-candidate-mobile')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Tạo mẻ/i })).not.toBeInTheDocument()
  })

  it('shows create action only with batch.create and switches tabs without a second data flow', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_CREATE)
    renderAt('/wash-batches', <WashBatchListPage />)
    expect(await screen.findByRole('link', { name: /Tạo mẻ/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Mẻ nháp' }))
    await waitFor(() => expect(mocks.list).toHaveBeenCalledOnce())
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

  it('selects compatible candidates, groups orders and units, blocks incompatible choices, and creates a draft', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_CREATE)
    mocks.permissions.add(PERMISSION_CODES.BATCH_MARK_READY)
    mocks.candidates.mockResolvedValue({
      items: [
        candidate(),
        candidate({ orderItemId: 12, orderId: 8, orderCode: 'CN01-DH-000008', itemTypeId: 4, itemTypeName: 'Chăn', quantity: 2, unitType: 'ITEM', warnings: ['ITEM_NOTE_PRESENT'] }),
        candidate({ orderItemId: 13, orderId: 9, orderCode: 'CN01-DH-000009', serviceId: 9, serviceName: 'Sấy' }),
        candidate({ orderItemId: 14, orderId: 10, orderCode: 'CN01-DH-000010', sharingMode: 'PRIVATE_LOAD' }),
      ], page: 0, size: 100, totalElements: 4, totalPages: 1,
    })
    const { container } = renderCreate()
    const first = await screen.findByRole('checkbox', { name: /CN01-DH-000007/ })
    await userEvent.click(first)
    await userEvent.click(screen.getByRole('checkbox', { name: /CN01-DH-000008/ }))
    expect(screen.getByRole('checkbox', { name: /CN01-DH-000009/ })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /CN01-DH-000010/ })).toBeDisabled()
    expect(screen.getByText(/Có ghi chú xử lý · Có loại đồ khác nhau/)).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3,5 KG').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2 MÓN').length).toBeGreaterThan(0)
    expect(container.querySelector('.batch-mobile-action')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Lưu mẻ nháp' }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ branchId: 1, orderItemIds: [11, 12], markReady: false })))
    expect(await screen.findByText('Chi tiết vừa tạo')).toBeInTheDocument()
  })

  it('creates and marks ready only when the generated permission is effective', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_CREATE)
    mocks.permissions.add(PERMISSION_CODES.BATCH_MARK_READY)
    renderCreate()
    await userEvent.click(await screen.findByRole('checkbox', { name: /CN01-DH-000007/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Đánh dấu sẵn sàng' }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ orderItemIds: [11], markReady: true })))
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
    expect(await screen.findAllByRole('button', { name: 'Xóa khỏi mẻ' })).toHaveLength(2)
    await userEvent.click(screen.getAllByRole('button', { name: 'Xóa khỏi mẻ' })[1])
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
    await userEvent.type(screen.getByRole('textbox', { name: 'Lý do' }), '  Đổi lịch vận hành  ')
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy' }))
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith(5, 1, 0, 'Đổi lịch vận hành'))
  })

  it('marks an active editor stale on realtime and handles a 409 without overwriting edits', async () => {
    mocks.permissions.add(PERMISSION_CODES.BATCH_READ)
    mocks.permissions.add(PERMISSION_CODES.BATCH_UPDATE)
    mocks.updateNote.mockRejectedValue(new ApiError(409, { status: 409, title: 'Conflict', detail: 'stale', errorCode: 'BATCH_VERSION_CONFLICT' }))
    renderAt('/wash-batches/5', <WashBatchDetailPage />, '/wash-batches/:batchId')
    const note = await screen.findByRole('textbox')
    await userEvent.type(note, 'Nội dung đang sửa')
    await waitFor(() => expect(mocks.subscribe.mock.calls.filter(([topic]) => topic === 'batch.').length).toBeGreaterThan(1))
    const realtimeCallback = mocks.subscribe.mock.calls.filter(([topic]) => topic === 'batch.').at(-1)?.[1]
    act(() => realtimeCallback?.({ entityId: 5 }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Mẻ giặt vừa được người khác cập nhật')
    await userEvent.click(screen.getByRole('button', { name: 'Tải dữ liệu mới nhất' }))
    await userEvent.type(note, 'Lưu lỗi')
    await userEvent.click(screen.getByRole('button', { name: 'Lưu ghi chú' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Mẻ giặt vừa được người khác cập nhật')
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
    mocks.candidates.mockResolvedValue({ items: [], page: 0, size: 100, totalElements: 0, totalPages: 0 })
    const empty = renderAt('/wash-batches', <WashBatchListPage />)
    expect(await screen.findByText('Không có đồ đang chờ ghép')).toBeInTheDocument()
    empty.unmount()
    mocks.candidates.mockRejectedValue(new Error('offline'))
    renderAt('/wash-batches', <WashBatchListPage />)
    expect(await screen.findByText('Không tải được danh sách chờ')).toBeInTheDocument()
    expect(screen.queryByText('Không có đồ đang chờ ghép')).not.toBeInTheDocument()
  })
})
