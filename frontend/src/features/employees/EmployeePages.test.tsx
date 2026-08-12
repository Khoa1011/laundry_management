import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_CODES, type PermissionCode } from '../../auth/permissionCodes.generated'
import i18n from '../../i18n'
import { EmployeeDetailPage } from './EmployeeDetailPage'
import { EmployeeFormPage } from './EmployeeFormPage'
import { EmployeeListPage } from './EmployeeListPage'
import type { EmployeeDetail, EmployeeListItem } from './types'

const fixtures = vi.hoisted(() => {
  const employee = {
    id: 7, employeeCode: 'NV-000007', fullName: 'Nguyen Minh Anh', phone: '0901 234 567', email: 'anh@example.test',
    birthDate: '1995-03-12', address: 'A long employee address', hireDate: '2026-07-01', status: 'ACTIVE',
    position: { id: 1, code: 'RECEPTIONIST', nameVi: 'Le tan', nameEn: 'Receptionist', active: true, sortOrder: 10, version: 0 },
    branches: [
      { id: 1, code: 'CN01', name: 'Chi nhanh trung tam', primary: true, active: true, assignedAt: '2026-07-01T00:00:00Z' },
      { id: 2, code: 'CN02', name: 'Chi nhanh phia dong', primary: false, active: true, assignedAt: '2026-07-02T00:00:00Z' },
    ],
    account: { id: 2, username: 'minh.anh', displayName: 'Nguyen Minh Anh', status: 'ACCOUNT_ACTIVE', branchAccess: [{ id: 1, code: 'CN01', name: 'Chi nhanh trung tam' }] },
    version: 3, createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-02T00:00:00Z',
  } as EmployeeDetail
  return {
    employee,
    listEmployee: { ...employee, primaryBranch: employee.branches[0], activeBranchCount: 2 } as EmployeeListItem,
    granted: [] as PermissionCode[],
    makePrimary: vi.fn(),
    notify: vi.fn(),
  }
})

vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ hasPermission: (permission: PermissionCode) => fixtures.granted.includes(permission), branchId: 1 }) }))
vi.mock('../../providers/ToastProvider', () => ({ useToast: () => ({ notify: fixtures.notify }) }))
vi.mock('./api', () => ({
  useEmployees: vi.fn(() => ({ data: { items: [fixtures.listEmployee], page: 0, size: 20, totalElements: 1, totalPages: 1, sort: [] }, isPending: false, isFetching: false, isError: false, error: null })),
  useEmployee: vi.fn(() => ({ data: fixtures.employee, isPending: false, isError: false, error: null, refetch: vi.fn() })),
  useMyEmployeeProfile: vi.fn(),
  useEmployeePositions: vi.fn(() => ({ data: [fixtures.employee.position], isPending: false, isError: false, refetch: vi.fn() })),
  useEmployeeBranchOptions: vi.fn(() => ({ data: [{ id: 1, code: 'CN01', name: 'Chi nhanh trung tam' }], isPending: false, isError: false, refetch: vi.fn() })),
  useEmployeeAccountOptions: vi.fn(() => ({ data: { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }, isPending: false })),
  useCreateEmployee: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false, isError: false })), useUpdateEmployee: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false, isError: false })), useChangeEmployeeStatus: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false, isError: false })),
  useAssignEmployeePosition: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false, isError: false })), useAssignEmployeeBranch: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false, isError: false })), useMakePrimaryEmployeeBranch: vi.fn(() => ({ mutateAsync: fixtures.makePrimary, isPending: false, isError: false })),
  useRemoveEmployeeBranch: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false, isError: false })), useLinkEmployeeAccount: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false, isError: false })), useUnlinkEmployeeAccount: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false, isError: false })),
  useEmployeeAudit: vi.fn(() => ({ data: { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }, isPending: false, isError: false })),
}))

function renderRoute(path: string, routePath: string, element: React.ReactNode) {
  const router = createMemoryRouter([{ path: routePath, element }], { initialEntries: [path] })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('employee pages', () => {
  beforeEach(() => {
    fixtures.granted = []
    fixtures.makePrimary.mockReset()
    fixtures.notify.mockReset()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  })

  it('renders a desktop table and mobile card from the same employee query', () => {
    fixtures.granted = [PERMISSION_CODES.EMPLOYEE_READ]
    const { container } = renderRoute('/employees', '/employees', <EmployeeListPage />)
    expect(screen.getAllByText('Nguyen Minh Anh').length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('.employee-table')).toBeInTheDocument()
    expect(container.querySelector('.employee-card')).toBeInTheDocument()
  })

  it('omits an editable employee code and supports one selected primary branch', async () => {
    fixtures.granted = [PERMISSION_CODES.EMPLOYEE_CREATE, PERMISSION_CODES.EMPLOYEE_POSITION_READ]
    renderRoute('/employees/new', '/employees/new', <EmployeeFormPage />)
    expect(screen.queryByLabelText(i18n.t('employee:code'))).not.toBeInTheDocument()
    const branchCheckbox = screen.getByRole('checkbox', { name: /Chi nhanh trung tam/i })
    await userEvent.click(branchCheckbox)
    expect(branchCheckbox).toBeChecked()
    expect(screen.getByRole('radio', { name: i18n.t('employee:primaryBranch') })).toBeChecked()
  })

  it('reports invalid form submission through a toast instead of a page banner', async () => {
    fixtures.granted = [PERMISSION_CODES.EMPLOYEE_CREATE, PERMISSION_CODES.EMPLOYEE_POSITION_READ]
    renderRoute('/employees/new', '/employees/new', <EmployeeFormPage />)

    await userEvent.click(screen.getByRole('button', { name: i18n.t('employee:saveCreate') }))

    expect(fixtures.notify).toHaveBeenCalledWith(i18n.t('validation:fixErrors'), 'error')
    expect(document.querySelector('.error-summary')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('employee:validation.branches'))
  })

  it('requires a reason before confirming suspension and warns about account lock', async () => {
    fixtures.granted = [PERMISSION_CODES.EMPLOYEE_READ, PERMISSION_CODES.EMPLOYEE_STATUS_CHANGE]
    renderRoute('/employees/7', '/employees/:employeeId', <EmployeeDetailPage />)
    await userEvent.click(screen.getByRole('button', { name: i18n.t('employee:changeStatus') }))
    const dialog = screen.getByRole('dialog', { name: i18n.t('employee:statusDialogTitle') })
    const statusSelect = dialog.querySelector('select')!
    await userEvent.selectOptions(statusSelect, 'SUSPENDED')
    expect(screen.getByText(i18n.t('employee:statusLockWarning'))).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: i18n.t('confirm') })
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: /Lý do|Reason/i }), 'Security review')
    expect(confirm).toBeEnabled()
  })

  it('sends the selected branch id when changing the primary branch', async () => {
    fixtures.granted = [PERMISSION_CODES.EMPLOYEE_READ, PERMISSION_CODES.EMPLOYEE_BRANCH_ASSIGN]
    renderRoute('/employees/7', '/employees/:employeeId', <EmployeeDetailPage />)
    await userEvent.click(screen.getByRole('button', { name: i18n.t('employee:makePrimary') }))
    expect(fixtures.makePrimary).toHaveBeenCalledWith({ branchId: 2, version: 3 })
  })
})
