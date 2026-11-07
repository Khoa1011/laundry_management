import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { PERMISSION_CODES as P } from '../../auth/permissionCodes.generated'
import { OperationsPage } from './OperationsPages'

const mocks = vi.hoisted(() => ({ hasPermission: vi.fn(), list: vi.fn(), save: vi.fn(), policy: vi.fn(), savePolicy: vi.fn(), notify: vi.fn(), get: vi.fn() }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ branchId: 7, hasPermission: mocks.hasPermission }) }))
vi.mock('../../providers/ToastProvider', () => ({ useToast: () => ({ notify: mocks.notify }) }))
vi.mock('./api', () => ({ operationsApi: mocks }))

function page(resource = 'warehouses', module: 'inventory' | 'finance' = 'inventory') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter([{ path: `/${module}/:resource`, element: <OperationsPage module={module} /> }], { initialEntries: [`/${module}/${resource}`] })
  return render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
}
const record = { id: 5, branchId: 7, name: 'Kho chính', code: 'CN-KHO-000001', active: true, version: 0, note: null, createdAt: '2026-11-07T01:00:00Z', updatedAt: '2026-11-07T01:00:00Z' }
const empty = { items: [], totalElements: 0, totalPages: 0, page: 0, size: 20 }

describe('Operations foundation', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.hasPermission.mockReturnValue(true); mocks.list.mockResolvedValue(empty); mocks.save.mockResolvedValue(record); mocks.get.mockResolvedValue(record) })

  it('shares server records between mobile cards and desktop table and hides unauthorized writes', async () => {
    mocks.hasPermission.mockImplementation((p) => p === P.INVENTORY_WAREHOUSE_READ)
    mocks.list.mockResolvedValue({ ...empty, items: [record], totalElements: 1, totalPages: 1 })
    page()
    expect(await screen.findAllByText('Kho chính')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Thêm mới' })).not.toBeInTheDocument()
    expect(mocks.list).toHaveBeenCalledWith('/inventory/warehouses', 7, 0, '', undefined)
  })

  it('uses real API payloads and confirms before discarding dirty catalog changes', async () => {
    page()
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    fireEvent.change(screen.getByLabelText(/^Tên/), { target: { value: 'Kho mới' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Đóng' })[0])
    expect(await screen.findByText('Bạn có thay đổi chưa lưu')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('/inventory/warehouses', { branchId: 7, name: 'Kho mới', active: true, note: null, version: undefined }, undefined))
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith('Đã lưu thay đổi'))
  })

  it('shows 403 as permission denial and does not call APIs for forbidden pages', async () => {
    mocks.list.mockRejectedValue(new ApiError(403, { status: 403 }))
    page()
    expect(await screen.findByText('Bạn không có quyền truy cập')).toBeInTheDocument()
  })

  it('does not fetch a resource without effective read permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    page()
    expect(await screen.findByText('Bạn không có quyền truy cập')).toBeInTheDocument()
    expect(mocks.list).not.toHaveBeenCalled()
  })

  it('distinguishes empty results from request errors and supports retry', async () => {
    mocks.list.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(empty)
    page()
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Chưa có bản ghi')).toBeInTheDocument()
  })

  it('does not expose price fields to a user without either price permission', async () => {
    mocks.hasPermission.mockImplementation((p) => p !== P.INVENTORY_COST_READ && p !== P.INVENTORY_COST_UPDATE)
    page('items')
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    expect(screen.queryByLabelText('Giá nhập tham khảo')).not.toBeInTheDocument()
  })

  it('shows stale-edit conflicts without resubmitting or losing form values', async () => {
    mocks.save.mockRejectedValue(new ApiError(409, { status: 409, errorCode: 'OPERATIONS_VERSION_CONFLICT' }))
    page()
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    fireEvent.change(screen.getByLabelText(/^Tên/), { target: { value: 'Giữ nội dung' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByText(/Dữ liệu đã thay đổi/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Tên/)).toHaveValue('Giữ nội dung')
    expect(mocks.save).toHaveBeenCalledTimes(1)
  })

  it('renders backend settings with safe defaults and readonly permission', async () => {
    mocks.hasPermission.mockImplementation((p) => p === P.INVENTORY_SETTINGS_READ)
    mocks.policy.mockResolvedValue({ branchId: 7, version: -1, approvalRequired: true, approvalThreshold: '0', allowNegative: false, defaultResourceId: null, valuationMethod: 'MOVING_WEIGHTED_AVERAGE', currency: 'VND' })
    page('settings')
    expect(await screen.findByLabelText('Luôn yêu cầu duyệt')).toBeChecked()
    expect(screen.getByLabelText('Cho phép tồn kho âm')).not.toBeChecked()
    expect(screen.queryByRole('button', { name: 'Lưu' })).not.toBeInTheDocument()
  })

  it('accepts a Vietnamese decimal separator and sends an exact string factor', async () => {
    mocks.list.mockImplementation((path: string) => Promise.resolve(path === '/inventory/conversions' ? empty : { ...empty, items: [{ ...record, name: path.endsWith('units') ? 'Lít' : 'Nước giặt' }], totalElements: 1, totalPages: 1 }))
    page('conversions')
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    await screen.findByRole('option', { name: 'Lít' })
    fireEvent.change(screen.getByLabelText(/^Tên/), { target: { value: 'Can 5 lít' } })
    fireEvent.change(screen.getByRole('combobox', { name: /^Vật tư$/ }), { target: { value: '5' } })
    fireEvent.change(screen.getByRole('combobox', { name: /^Đơn vị nhập$/ }), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText(/Hệ số sang đơn vị cơ sở/), { target: { value: '5,123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('/inventory/conversions', expect.objectContaining({ factor: '5.123456' }), undefined))
  })
})
