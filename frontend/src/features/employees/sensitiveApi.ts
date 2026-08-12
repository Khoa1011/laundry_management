import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, apiRequestBlob } from '../../api/client'
import type {
  Compensation, CompensationCurrent, CompensationHistory, CompensationInput, EmployeeDocument,
  EmployeeDocumentList, EmployeeDocumentStatus, EmployeeDocumentType, EmployeeIdentity,
  IdentityInput, IdentityType, IdentityVerificationStatus,
} from './sensitiveTypes'

export function useEmployeeCompensation(employeeId: number, enabled: boolean) {
  return useQuery({ queryKey: ['employee-compensation', employeeId], enabled,
    queryFn: ({ signal }) => apiRequest<CompensationCurrent>(`/api/employees/${employeeId}/compensation`, { signal }) })
}
export function useEmployeeCompensationHistory(employeeId: number, enabled: boolean) {
  return useQuery({ queryKey: ['employee-compensation-history', employeeId], enabled,
    queryFn: ({ signal }) => apiRequest<CompensationHistory>(`/api/employees/${employeeId}/compensation/history?page=0&size=30`, { signal }) })
}
export function useUpdateEmployeeCompensation(employeeId: number) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (body: CompensationInput) => apiRequest<Compensation>(`/api/employees/${employeeId}/compensation`, { method: 'POST', body }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['employee-compensation', employeeId] }); void client.invalidateQueries({ queryKey: ['employee-compensation-history', employeeId] }) } })
}

export function useEmployeeIdentity(employeeId: number, reveal: boolean, enabled: boolean) {
  return useQuery({ queryKey: ['employee-identity', employeeId, reveal], enabled, retry: false, gcTime: reveal ? 0 : 300_000,
    queryFn: ({ signal }) => apiRequest<EmployeeIdentity>(`/api/employees/${employeeId}/identity?type=CITIZEN_ID&reveal=${reveal}`, { signal }) })
}
export function useUpsertEmployeeIdentity(employeeId: number) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (body: IdentityInput) => apiRequest<void>(`/api/employees/${employeeId}/identity`, { method: 'PUT', body }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['employee-identity', employeeId] }) })
}
export function useVerifyEmployeeIdentity(employeeId: number) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (body: { type: IdentityType; status: IdentityVerificationStatus; reason?: string; version: number }) =>
    apiRequest<void>(`/api/employees/${employeeId}/identity/verification?type=${body.type}`, { method: 'PATCH', body: { status: body.status, reason: body.reason, version: body.version } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['employee-identity', employeeId] }) })
}

export function useEmployeeDocuments(employeeId: number, status: EmployeeDocumentStatus, enabled: boolean) {
  return useQuery({ queryKey: ['employee-documents', employeeId, status], enabled,
    queryFn: ({ signal }) => apiRequest<EmployeeDocumentList>(`/api/employees/${employeeId}/documents?status=${status}&page=0&size=50`, { signal }) })
}
function documentForm(file: File, description?: string, type?: EmployeeDocumentType) {
  const form = new FormData(); form.append('file', file)
  if (description?.trim()) form.append('description', description.trim())
  if (type) form.append('type', type)
  return form
}
export function useUploadEmployeeDocument(employeeId: number) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: { file: File; description?: string; type: EmployeeDocumentType }) =>
    apiRequest<EmployeeDocument>(`/api/employees/${employeeId}/documents`, { method: 'POST', body: documentForm(input.file, input.description, input.type) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['employee-documents', employeeId] }) })
}
export function useReplaceEmployeeDocument(employeeId: number) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: { documentId: number; file: File; description?: string }) =>
    apiRequest<EmployeeDocument>(`/api/employees/${employeeId}/documents/${input.documentId}/replacement`, { method: 'POST', body: documentForm(input.file, input.description) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['employee-documents', employeeId] }) })
}
export function useDeleteEmployeeDocument(employeeId: number) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: { documentId: number; reason: string; recordVersion: number }) =>
    apiRequest<void>(`/api/employees/${employeeId}/documents/${input.documentId}`, { method: 'DELETE', body: { reason: input.reason, recordVersion: input.recordVersion } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['employee-documents', employeeId] }) })
}
export const loadEmployeeDocument = (employeeId: number, documentId: number, download = false) =>
  apiRequestBlob(`/api/employees/${employeeId}/documents/${documentId}/content?download=${download}`)
