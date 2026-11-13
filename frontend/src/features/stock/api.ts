import { apiRequest, apiRequestBlob } from '../../api/client'
import type { PageResponse } from '../../api/types'
import type { Balance, Dashboard, Document, Filters, Input, Kind, Ledger, Report, Revision } from './types'
export function query(branchId: number, filters: Filters, page: number, kind?: Kind) {
  const values: Record<string, string> = { branchId: String(branchId), page: String(page), size: '20', ...(kind ? { kind } : {}) }
  for (const [k, v] of Object.entries(filters)) if (v) values[k] = k === 'from' ? new Date(`${v}T00:00:00+07:00`).toISOString() : k === 'to' ? new Date(new Date(`${v}T00:00:00+07:00`).getTime() + 86400000).toISOString() : v
  return new URLSearchParams(values).toString()
}
export const stockApi = {
  documents: (q: string) => apiRequest<PageResponse<Document> & { summary: { totalValue: string | null } }>(`/api/inventory/documents?${q}`),
  detail: (id: number, branchId: number) => apiRequest<Document>(`/api/inventory/documents/${id}?branchId=${branchId}`),
  history: (id: number, branchId: number, page: number) => apiRequest<PageResponse<Revision>>(`/api/inventory/documents/${id}/history?branchId=${branchId}&page=${page}&size=20`),
  preview: (body: Input, id?: number) => apiRequest<Document>(`/api/inventory/documents/preview${id ? `?documentId=${id}` : ''}`, { method: 'POST', body }),
  packages: (branchId: number, itemId: number) => apiRequest<Array<{ id: number; name: string; factor: string }>>(`/api/inventory/packages?branchId=${branchId}&itemId=${itemId}`),
  save: (body: Input, key: string, id?: number) => apiRequest<Document>(`/api/inventory/documents${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Idempotency-Key': key }, body }),
  cancel: (id: number, branchId: number, version: number, reason: string, key: string) => apiRequest<Document>(`/api/inventory/documents/${id}/cancel`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: { branchId, version, reason } }),
  settle: (id: number, branchId: number, version: number, reason: string, lines: Array<{ lineNumber: number; quantity: string }>, returning: boolean, key: string) => apiRequest<Document>(`/api/inventory/documents/${id}/${returning ? 'return-transit' : 'receive'}`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: { branchId, version, reason, lines } }),
  balances: (q: string) => apiRequest<PageResponse<Balance>>(`/api/inventory/balances?${q}`),
  lots: (branchId: number, warehouseId: number, itemId: number) => apiRequest<Array<{ lotCode: string; expiryDate: string | null; quantity: string }>>(`/api/inventory/lots?branchId=${branchId}&warehouseId=${warehouseId}&itemId=${itemId}`),
  ledger: (q: string) => apiRequest<PageResponse<Ledger>>(`/api/inventory/ledger?${q}`),
  report: (q: string) => apiRequest<PageResponse<Report>>(`/api/inventory/reports?${q}`),
  dashboard: (q: string) => apiRequest<Dashboard>(`/api/inventory/dashboard?${q}`),
  export: (q: string) => apiRequestBlob(`/api/inventory/reports/export.csv?${q}`),
}
