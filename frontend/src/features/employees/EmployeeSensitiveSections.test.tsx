import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_CODES, type PermissionCode } from '../../auth/permissionCodes.generated'
import i18n from '../../i18n'
import { EmployeeSensitiveSections } from './EmployeeSensitiveSections'

const fixtures = vi.hoisted(() => ({ granted: [] as PermissionCode[], identityQuery: vi.fn(), documentsQuery: vi.fn(), loadDocument: vi.fn(), notify: vi.fn() }))
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ hasPermission: (permission: PermissionCode) => fixtures.granted.includes(permission) }) }))
vi.mock('../../providers/ToastProvider', () => ({ useToast: () => ({ notify: fixtures.notify }) }))
vi.mock('./sensitiveApi', () => ({
  useEmployeeCompensation: vi.fn(() => ({ isPending: false, isError: false, data: { current: null, scheduled: null } })),
  useEmployeeCompensationHistory: vi.fn(() => ({ isPending: false, isError: false, data: { items: [] } })),
  useUpdateEmployeeCompensation: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
  useEmployeeIdentity: (...args: unknown[]) => fixtures.identityQuery(...args),
  useUpsertEmployeeIdentity: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
  useVerifyEmployeeIdentity: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
  useEmployeeDocuments: (...args: unknown[]) => fixtures.documentsQuery(...args),
  useUploadEmployeeDocument: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
  useReplaceEmployeeDocument: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
  useDeleteEmployeeDocument: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
  loadEmployeeDocument: (...args: unknown[]) => fixtures.loadDocument(...args),
}))

describe('employee confidential records', () => {
  beforeEach(() => {
    fixtures.granted = []
    fixtures.notify.mockReset()
    fixtures.loadDocument.mockReset()
    fixtures.documentsQuery.mockReset().mockReturnValue({ isPending: false, isError: false, data: { items: [] } })
    fixtures.identityQuery.mockReset().mockImplementation((_employeeId: number, reveal: boolean) => ({
      isPending: false, isError: false,
      data: { id: 1, identityType: 'CITIZEN_ID', number: reveal ? '079203001234' : '********1234', masked: !reveal,
        verificationStatus: 'NOT_VERIFIED', version: 0, updatedAt: '2026-07-20T00:00:00Z' },
    }))
  })

  it('renders no confidential surface when no sensitive permission is effective', () => {
    const { container } = render(<EmployeeSensitiveSections employeeId={7} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows only permission-backed tabs and masks identity until an explicit reveal', async () => {
    fixtures.granted = [PERMISSION_CODES.EMPLOYEE_IDENTITY_MASKED_READ, PERMISSION_CODES.EMPLOYEE_IDENTITY_READ]
    render(<EmployeeSensitiveSections employeeId={7} />)
    expect(screen.getByRole('tab', { name: i18n.t('employee:sensitive.identity') })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: i18n.t('employee:sensitive.compensation') })).not.toBeInTheDocument()
    expect(screen.getByText('********1234')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: i18n.t('employee:sensitive.revealNumber') }))
    expect(fixtures.identityQuery).toHaveBeenLastCalledWith(7, true, true)
    expect(screen.getByText('079203001234')).toBeInTheDocument()
  })

  it('keeps manager-style document metadata read-only', () => {
    fixtures.granted = [PERMISSION_CODES.EMPLOYEE_FILE_READ]
    render(<EmployeeSensitiveSections employeeId={7} />)
    expect(screen.getByRole('tab', { name: i18n.t('employee:sensitive.documents') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: i18n.t('employee:sensitive.uploadDocument') })).not.toBeInTheDocument()
  })

  it('loads an authenticated image thumbnail and opens it in the preview dialog', async () => {
    fixtures.granted = [PERMISSION_CODES.EMPLOYEE_FILE_READ, PERMISSION_CODES.EMPLOYEE_FILE_DOWNLOAD]
    fixtures.documentsQuery.mockReturnValue({ isPending: false, isError: false, data: { items: [{
      id: 41, documentType: 'IDENTITY_COPY', originalFilename: 'cccd.png', contentType: 'image/png', sizeBytes: 128,
      documentVersion: 1, status: 'ACTIVE', recordVersion: 0, actor: { id: 1, displayName: 'Owner' }, createdAt: '2026-07-20T00:00:00Z',
    }] } })
    fixtures.loadDocument.mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:employee-document')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    render(<EmployeeSensitiveSections employeeId={7} />)
    await waitFor(() => expect(fixtures.loadDocument).toHaveBeenCalledWith(7, 41))
    await userEvent.click(screen.getByRole('button', { name: `${i18n.t('employee:sensitive.preview')}: cccd.png` }))

    expect(await screen.findByRole('dialog', { name: 'cccd.png' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'cccd.png' })).toHaveAttribute('src', 'blob:employee-document')
  })
})
