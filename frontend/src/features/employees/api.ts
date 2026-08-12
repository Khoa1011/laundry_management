import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../../api/client'
import type {
  AccountOptionList, BranchOption, EmployeeAccountState, EmployeeAuditList, EmployeeDetail,
  EmployeeInput, EmployeeListResponse, EmployeePosition, EmployeeSelfProfile, EmployeeStatus,
} from './types'

export interface EmployeeFilters {
  page: number
  size: number
  search: string
  status: '' | EmployeeStatus
  positionId: string
  branchId: string
  accountStatus: '' | EmployeeAccountState
  sort: string
}

function employeeListPath(filters: EmployeeFilters) {
  const params = new URLSearchParams({ page: String(filters.page), size: String(filters.size) })
  if (filters.search) params.set('search', filters.search)
  if (filters.status) params.set('status', filters.status)
  if (filters.positionId) params.set('positionId', filters.positionId)
  if (filters.branchId) params.set('branchId', filters.branchId)
  if (filters.accountStatus) params.set('accountStatus', filters.accountStatus)
  if (filters.sort) params.set('sort', filters.sort)
  return `/api/employees?${params.toString()}`
}

export function useEmployees(filters: EmployeeFilters) {
  return useQuery({
    queryKey: ['employees', filters],
    queryFn: ({ signal }) => apiRequest<EmployeeListResponse>(employeeListPath(filters), { signal }),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  })
}

export function useEmployee(employeeId: number | null) {
  return useQuery({
    queryKey: ['employee', employeeId],
    queryFn: ({ signal }) => apiRequest<EmployeeDetail>(`/api/employees/${employeeId}`, { signal }),
    enabled: employeeId !== null,
    staleTime: 10_000,
  })
}

export function useMyEmployeeProfile() {
  return useQuery({ queryKey: ['employee-me'], queryFn: ({ signal }) => apiRequest<EmployeeSelfProfile>('/api/employees/me', { signal }) })
}

export function useEmployeePositions(includeInactive = false) {
  return useQuery({
    queryKey: ['employee-positions', includeInactive],
    queryFn: ({ signal }) => apiRequest<EmployeePosition[]>(`/api/employee-positions?includeInactive=${includeInactive}`, { signal }),
    staleTime: 60_000,
  })
}

export interface EmployeePositionInput {
  code?: string
  nameVi: string
  nameEn: string
  descriptionVi?: string
  descriptionEn?: string
  active?: boolean
  sortOrder: number
  version?: number
}

export function useCreateEmployeePosition() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: EmployeePositionInput & { code: string }) => apiRequest<EmployeePosition>('/api/employee-positions', { method: 'POST', body: input }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['employee-positions'] }),
  })
}

export function useUpdateEmployeePosition(positionId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: EmployeePositionInput & { active: boolean; version: number }) => apiRequest<EmployeePosition>(`/api/employee-positions/${positionId}`, { method: 'PATCH', body: input }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['employee-positions'] }),
  })
}

export function useEmployeeBranchOptions() {
  return useQuery({
    queryKey: ['employee-branch-options'],
    queryFn: ({ signal }) => apiRequest<BranchOption[]>('/api/employees/options/branches', { signal }),
    staleTime: 60_000,
  })
}

export function useEmployeeAccountOptions(employeeId: number | null, search: string, enabled: boolean) {
  const params = new URLSearchParams({ page: '0', size: '30' })
  if (employeeId !== null) params.set('employeeId', String(employeeId))
  if (search.trim()) params.set('search', search.trim())
  return useQuery({
    queryKey: ['employee-account-options', employeeId, search],
    queryFn: ({ signal }) => apiRequest<AccountOptionList>(`/api/employees/account-options?${params}`, { signal }),
    enabled,
  })
}

function invalidateEmployee(client: ReturnType<typeof useQueryClient>, employee: EmployeeDetail) {
  client.setQueryData(['employee', employee.id], employee)
  void client.invalidateQueries({ queryKey: ['employees'] })
  void client.invalidateQueries({ queryKey: ['employee-audit', employee.id] })
}

export function useCreateEmployee() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: EmployeeInput) => apiRequest<EmployeeDetail>('/api/employees', { method: 'POST', body: input }),
    onSuccess: (employee) => invalidateEmployee(client, employee),
  })
}

export function useUpdateEmployee(employeeId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<EmployeeInput, 'positionId' | 'status' | 'branchIds' | 'primaryBranchId' | 'linkedUserId'> & { version: number }) =>
      apiRequest<EmployeeDetail>(`/api/employees/${employeeId}`, { method: 'PUT', body: input }),
    onSuccess: (employee) => invalidateEmployee(client, employee),
  })
}

function useEmployeeAction<T>(employeeId: number, path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'PATCH') {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: T) => apiRequest<EmployeeDetail>(`/api/employees/${employeeId}${path}`, { method, body }),
    onSuccess: (employee) => invalidateEmployee(client, employee),
  })
}

export const useChangeEmployeeStatus = (employeeId: number) => useEmployeeAction<{ status: EmployeeStatus; reason?: string; version: number }>(employeeId, '/status')
export const useAssignEmployeePosition = (employeeId: number) => useEmployeeAction<{ positionId: number; version: number }>(employeeId, '/position')
export const useAssignEmployeeBranch = (employeeId: number) => useEmployeeAction<{ branchId: number; primary: boolean; version: number }>(employeeId, '/branches', 'POST')
export function useMakePrimaryEmployeeBranch(employeeId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ branchId, version }: { branchId: number; version: number }) =>
      apiRequest<EmployeeDetail>(`/api/employees/${employeeId}/branches/${branchId}/primary`, { method: 'PATCH', body: { version } }),
    onSuccess: (employee) => invalidateEmployee(client, employee),
  })
}

export function useRemoveEmployeeBranch(employeeId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ branchId, version }: { branchId: number; version: number }) =>
      apiRequest<EmployeeDetail>(`/api/employees/${employeeId}/branches/${branchId}`, { method: 'DELETE', body: { version } }),
    onSuccess: (employee) => invalidateEmployee(client, employee),
  })
}
export const useLinkEmployeeAccount = (employeeId: number) => useEmployeeAction<{ userId: number; version: number }>(employeeId, '/account', 'PUT')
export const useUnlinkEmployeeAccount = (employeeId: number) => useEmployeeAction<{ version: number }>(employeeId, '/account', 'DELETE')

export function useEmployeeAudit(employeeId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['employee-audit', employeeId],
    queryFn: ({ signal }) => apiRequest<EmployeeAuditList>(`/api/employees/${employeeId}/audit?page=0&size=30`, { signal }),
    enabled,
  })
}
