import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import type { Role, RoleMatrix } from './types'
import { RoleDetailPage, RoleFormPage } from './RolePages'

const apiMocks = vi.hoisted(() => ({
  useRole: vi.fn(),
  useRoles: vi.fn(),
  useRoleMatrix: vi.fn(),
  useRoleUsers: vi.fn(),
  useRoleAudit: vi.fn(),
  useAccessMutations: vi.fn(),
}))

vi.mock('./api', () => apiMocks)
vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))
const notify = vi.fn()
vi.mock('../../providers/ToastProvider', () => ({
  useToast: () => ({ notify }),
}))

const customRole: Role = {
  id: 12,
  code: 'CUSTOM_ROLE_000012',
  displayName: 'Nhân viên kho ca sáng',
  description: 'Quản lý tồn kho và phiếu nhập.',
  nameVi: '',
  nameEn: '',
  descriptionVi: null,
  descriptionEn: null,
  status: 'ACTIVE',
  system: false,
  version: 3,
  assignedUsers: 1,
  permissionCount: 2,
  createdAt: '2026-07-16T08:00:00Z',
  updatedAt: '2026-07-16T09:00:00Z',
  createdBy: { id: 1, displayName: 'Owner' },
  updatedBy: { id: 1, displayName: 'Owner' },
}

const matrix: RoleMatrix = {
  role: customRole,
  permissionCodes: ['customer.read', 'customer.update'],
  modules: [{
    module: 'customer',
    nameVi: 'Khách hàng',
    nameEn: 'Customer Management',
    displayOrder: 10,
    permissions: [
      { id: 1, code: 'customer.read', module: 'customer', resource: 'customer', action: 'read', nameVi: 'Xem khách hàng', nameEn: 'View customers', riskLevel: 'LOW', displayOrder: 10, status: 'ACTIVE' },
      { id: 2, code: 'customer.update', module: 'customer', resource: 'customer', action: 'update', nameVi: 'Cập nhật khách hàng', nameEn: 'Update customers', riskLevel: 'MEDIUM', displayOrder: 20, status: 'ACTIVE' },
    ],
  }],
  version: 3,
  assignedUserCount: 1,
  highRiskPermissionCount: 0,
}

const emptyPage = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }
const createRole = vi.fn()
const updateRole = vi.fn()
const cloneRole = vi.fn()
const changeRoleStatus = vi.fn()

function mutations() {
  return {
    createRole: { mutateAsync: createRole, isPending: false },
    updateRole: { mutateAsync: updateRole, isPending: false },
    cloneRole: { mutateAsync: cloneRole, isPending: false },
    changeRoleStatus: { mutateAsync: changeRoleStatus, isPending: false },
  }
}

function query<T>(data: T) {
  return { data, isPending: false, isError: false, error: null, refetch: vi.fn() }
}

function renderRoute(path: string, routePath: string, element: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([
    { path: routePath, element },
    { path: '/settings/access/roles/:roleId/permissions', element: <div>Matrix destination</div> },
    { path: '/settings/access/roles/:roleId', element: <div>Role destination</div> },
  ], { initialEntries: [path] })
  return render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
}

describe('Role management pages', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage('en')
    apiMocks.useAccessMutations.mockReturnValue(mutations())
    apiMocks.useRoleUsers.mockReturnValue(query(emptyPage))
    apiMocks.useRoleAudit.mockReturnValue(query(emptyPage))
  })

  it('renders the simplified create form and submits generated-code input only', async () => {
    const user = userEvent.setup()
    apiMocks.useRole.mockReturnValue(query(undefined))
    apiMocks.useRoles.mockReturnValue(query({ ...emptyPage, items: [customRole], totalElements: 1, totalPages: 1 }))
    createRole.mockResolvedValue({ ...customRole, id: 20, code: 'CUSTOM_ROLE_000020' })
    renderRoute('/settings/access/roles/new', '/settings/access/roles/new', <RoleFormPage />)

    expect(screen.getByLabelText('Role name *')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByLabelText('Copy permissions from')).toBeInTheDocument()
    expect(screen.queryByLabelText(/code/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/English name/i)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Role name *'), 'Morning cashier')
    await user.selectOptions(screen.getByLabelText('Copy permissions from'), '12')
    expect(screen.getByText(/will copy 2 permissions/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create and configure permissions' }))

    expect(createRole).toHaveBeenCalledWith({
      displayName: 'Morning cashier',
      description: null,
      copyPermissionsFromRoleId: 12,
    })
    expect(await screen.findByText('Matrix destination')).toBeInTheDocument()
  })

  it('reports invalid role submission through a toast instead of a page banner', async () => {
    const user = userEvent.setup()
    apiMocks.useRole.mockReturnValue(query(undefined))
    apiMocks.useRoles.mockReturnValue(query(emptyPage))
    renderRoute('/settings/access/roles/new', '/settings/access/roles/new', <RoleFormPage />)

    await user.click(screen.getByRole('button', { name: 'Create and configure permissions' }))

    expect(notify).toHaveBeenCalledWith(i18n.t('validation:fixErrors'), 'error')
    expect(document.querySelector('.error-summary')).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t('access:nameRequired'))).toBeInTheDocument()
  })

  it('renders compact role detail tabs and supports arrow-key navigation', async () => {
    const user = userEvent.setup()
    apiMocks.useRole.mockReturnValue(query(customRole))
    apiMocks.useRoleMatrix.mockReturnValue(query(matrix))
    renderRoute('/settings/access/roles/12', '/settings/access/roles/:roleId', <RoleDetailPage />)

    expect(screen.getByRole('heading', { name: customRole.displayName })).toBeInTheDocument()
    expect(screen.getAllByText(customRole.code).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Custom role').length).toBeGreaterThan(0)
    const overview = screen.getByRole('tab', { name: 'Overview' })
    const permissions = screen.getByRole('tab', { name: /Permission matrix/ })
    expect(overview).toHaveAttribute('aria-selected', 'true')
    overview.focus()
    await user.keyboard('{ArrowRight}')
    expect(permissions).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Total selected permissions')).toBeInTheDocument()
  })

  it('opens cloning from the secondary menu without technical or translation fields', async () => {
    const user = userEvent.setup()
    apiMocks.useRole.mockReturnValue(query(customRole))
    apiMocks.useRoleMatrix.mockReturnValue(query(matrix))
    renderRoute('/settings/access/roles/12', '/settings/access/roles/:roleId', <RoleDetailPage />)

    await user.click(screen.getByLabelText('More actions'))
    await user.click(screen.getByText('Clone role'))
    expect(screen.getByRole('dialog', { name: 'Clone role' })).toBeInTheDocument()
    expect(screen.getByLabelText('New role name *')).toBeInTheDocument()
    expect(screen.getByLabelText('Reason for cloning *')).toBeInTheDocument()
    expect(screen.queryByLabelText(/system code/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/English description/i)).not.toBeInTheDocument()
  })

  it('switches system role application metadata immediately between English and Vietnamese', async () => {
    const systemRole = {
      ...customRole,
      code: 'OWNER',
      displayName: 'Chủ cửa hàng',
      nameVi: 'Chủ cửa hàng',
      nameEn: 'Owner',
      system: true,
    }
    apiMocks.useRole.mockReturnValue(query(systemRole))
    apiMocks.useRoleMatrix.mockReturnValue(query({ ...matrix, role: systemRole }))
    renderRoute('/settings/access/roles/12', '/settings/access/roles/:roleId', <RoleDetailPage />)
    expect(screen.getByRole('heading', { name: 'Owner' })).toBeInTheDocument()
    await i18n.changeLanguage('vi')
    expect(await screen.findByRole('heading', { name: 'Chủ cửa hàng' })).toBeInTheDocument()
  })

  it.each(['laundry-teal', 'laundry-indigo'])('uses semantic tokens under the %s theme', (theme) => {
    document.documentElement.dataset.theme = theme
    apiMocks.useRoleMatrix.mockReturnValue(query(matrix))
    renderRoute('/settings/access/roles/12', '/settings/access/roles/:roleId', <RoleDetailPage />)
    const page = document.querySelector('.role-detail-page')
    expect(page).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe(theme)
    expect(page?.querySelector('[style*="#"]')).toBeNull()
  })
})
