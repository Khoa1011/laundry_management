import { apiRequest } from '../../api/client'
import type { PageResponse } from '../../api/types'
import type { CatalogRecord, Module, Policy } from './catalog'

export const operationsApi = {
  list: (path: string, branchId: number, page = 0, search = '', active?: boolean) => apiRequest<PageResponse<CatalogRecord>>(`/api${path}?${new URLSearchParams({ branchId: String(branchId), page: String(page), size: '20', search, ...(active === undefined ? {} : { active: String(active) }) })}`),
  get: (path: string, branchId: number, id: number) => apiRequest<CatalogRecord>(`/api${path}/${id}?branchId=${branchId}`),
  save: (path: string, body: Record<string, unknown>, id?: number) => apiRequest<CatalogRecord>(`/api${path}${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body }),
  policy: (module: Module, branchId: number) => apiRequest<Policy>(`/api/${module}/settings?branchId=${branchId}`),
  savePolicy: (module: Module, body: Record<string, unknown>) => apiRequest<Policy>(`/api/${module}/settings`, { method: 'PUT', body }),
  history: (module: Module, branchId: number, page: number) => apiRequest<PageResponse<Audit>>(`/api/${module}/history?branchId=${branchId}&page=${page}&size=20`),
}
export type Audit = { id: number; resource: string; recordId: number; action: string; actorId: number; occurredAt: string; changedFields: string }
