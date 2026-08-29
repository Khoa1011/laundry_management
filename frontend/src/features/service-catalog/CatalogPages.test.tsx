import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { ItemTypeCatalogPage, ServiceCatalogPage } from './CatalogPages'

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  services: vi.fn(),
  itemTypes: vi.fn(),
  notify: vi.fn(),
}))

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    branchId: 7,
    hasPermission: mocks.hasPermission,
  }),
}))

vi.mock('../../providers/ToastProvider', () => ({
  useToast: () => ({ notify: mocks.notify }),
}))

vi.mock('./api', () => ({
  catalogApi: {
    services: mocks.services,
    itemTypes: mocks.itemTypes,
  },
}))

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/catalog/services']}>
        <ServiceCatalogPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function renderItemTypePage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/catalog/item-types']}>
        <ItemTypeCatalogPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ServiceCatalogPage', () => {
  beforeEach(() => {
    mocks.hasPermission.mockReset()
    mocks.services.mockReset()
    mocks.itemTypes.mockReset()
    mocks.itemTypes.mockResolvedValue([])
    mocks.notify.mockReset()
  })

  it('renders shared mobile-card and desktop-table data without exposing unauthorized actions', async () => {
    mocks.hasPermission.mockImplementation(
      (permission: string) => permission === PERMISSION_CODES.SERVICE_READ,
    )
    mocks.services.mockResolvedValue({
      items: [{
        id: 11,
        code: 'DV-000001',
        nameVi: 'Giặt sấy tiêu chuẩn',
        processingType: 'WASH_DRY',
        defaultUnitType: 'KG',
        sharingAllowed: true,
        status: 'ACTIVE',
        createdAt: '2026-07-26T00:00:00Z',
        updatedAt: '2026-07-26T01:00:00Z',
        updatedBy: { id: 1, name: 'Manager' },
        version: 0,
      }],
      page: 0,
      size: 100,
      totalElements: 1,
      totalPages: 1,
    })

    renderPage()

    expect((await screen.findAllByText('Giặt sấy tiêu chuẩn')).length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByRole('button', { name: 'Thêm dịch vụ' })).not.toBeInTheDocument()
    expect(mocks.hasPermission).toHaveBeenCalledWith(PERMISSION_CODES.SERVICE_CREATE)
  })

  it('shows a permission-aware empty state', async () => {
    mocks.hasPermission.mockReturnValue(true)
    mocks.services.mockResolvedValue({
      items: [], page: 0, size: 100, totalElements: 0, totalPages: 0,
    })

    renderPage()

    expect(await screen.findByText('Thiết lập dịch vụ & giá bán')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Thêm dịch vụ' }).length).toBeGreaterThanOrEqual(1)
  })

  it('uses the shared row action menu for permitted service actions', async () => {
    mocks.hasPermission.mockReturnValue(true)
    mocks.services.mockResolvedValue({
      items: [{
        id: 11, code: 'DV-000001', nameVi: 'Giặt sấy tiêu chuẩn', processingType: 'WASH_DRY',
        defaultUnitType: 'KG', sharingAllowed: true, status: 'ACTIVE', eligibleItemTypeCount: 2,
        relatedPriceRuleCount: 1, createdAt: '2026-07-26T00:00:00Z', updatedAt: '2026-07-26T01:00:00Z',
        updatedBy: { id: 1, name: 'Manager' }, version: 0,
      }],
      page: 0, size: 100, totalElements: 1, totalPages: 1,
    })

    renderPage()
    const menus = await screen.findAllByRole('button', { name: 'Mở menu' })
    fireEvent.click(menus[0])

    expect(await screen.findByRole('menuitem', { name: 'Chỉnh sửa' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Ngừng hoạt động' })).toBeInTheDocument()
  })

  it('keeps required-name validation next to the field instead of calling the API', async () => {
    mocks.hasPermission.mockReturnValue(true)
    mocks.services.mockResolvedValue({
      items: [], page: 0, size: 100, totalElements: 0, totalPages: 0,
    })

    renderPage()
    await screen.findByText('Thiết lập dịch vụ & giá bán')
    fireEvent.click(screen.getAllByRole('button', { name: 'Thêm dịch vụ' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng nhập tên hiển thị.')
  })
})

describe('ItemTypeCatalogPage', () => {
  beforeEach(() => {
    mocks.hasPermission.mockReturnValue(true)
    mocks.itemTypes.mockReset()
  })

  it('expands and collapses parent item groups without hiding the parent row', async () => {
    const child = {
      id: 2, code: 'LD-000002', parentId: 1, nameVi: 'Áo sơ mi', effectiveUnitType: 'KG',
      inheritedUnit: true, requiresSeparateWash: false, sortOrder: 10, status: 'ACTIVE',
      createdAt: '2026-07-26T00:00:00Z', updatedAt: '2026-07-26T01:00:00Z',
      updatedBy: { id: 1, name: 'Manager' }, version: 0, applicableServiceCount: 1,
      relatedPriceRuleCount: 0, children: [],
    }
    mocks.itemTypes.mockResolvedValue([{
      id: 1, code: 'LD-000001', nameVi: 'Quần áo', defaultUnitType: 'KG', effectiveUnitType: 'KG',
      inheritedUnit: false, requiresSeparateWash: false, sortOrder: 10, status: 'ACTIVE',
      createdAt: '2026-07-26T00:00:00Z', updatedAt: '2026-07-26T01:00:00Z',
      updatedBy: { id: 1, name: 'Manager' }, version: 0, applicableServiceCount: 1,
      relatedPriceRuleCount: 0, children: [child],
    }])

    renderItemTypePage()

    const expand = await screen.findByRole('button', { name: 'Mở nhóm Quần áo' })
    expect(screen.queryByText('Áo sơ mi')).not.toBeInTheDocument()
    fireEvent.click(expand)
    expect(await screen.findByText('Áo sơ mi')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn nhóm Quần áo' }))
    expect(screen.queryByText('Áo sơ mi')).not.toBeInTheDocument()
    expect(screen.getByText('Quần áo')).toBeInTheDocument()
  })

  it('does not ask users to enter a technical display order', async () => {
    mocks.itemTypes.mockResolvedValue([])

    renderItemTypePage()

    const addButtons = await screen.findAllByRole('button', { name: 'Thêm loại đồ' })
    fireEvent.click(addButtons[0])

    expect(screen.getByRole('dialog', { name: 'Thêm loại đồ' })).toBeInTheDocument()
    expect(screen.queryByText('Thứ tự')).not.toBeInTheDocument()
  })
})
