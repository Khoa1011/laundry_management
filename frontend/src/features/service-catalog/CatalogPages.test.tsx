import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { ServiceCatalogPage } from './CatalogPages'

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  services: vi.fn(),
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

describe('ServiceCatalogPage', () => {
  beforeEach(() => {
    mocks.hasPermission.mockReset()
    mocks.services.mockReset()
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

    expect(await screen.findByText('Chưa có dịch vụ nào')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Thêm dịch vụ' }).length).toBeGreaterThanOrEqual(1)
  })

  it('keeps required-name validation next to the field instead of calling the API', async () => {
    mocks.hasPermission.mockReturnValue(true)
    mocks.services.mockResolvedValue({
      items: [], page: 0, size: 100, totalElements: 0, totalPages: 0,
    })

    renderPage()
    await screen.findByText('Chưa có dịch vụ nào')
    fireEvent.click(screen.getAllByRole('button', { name: 'Thêm dịch vụ' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng nhập tên hiển thị.')
  })
})
