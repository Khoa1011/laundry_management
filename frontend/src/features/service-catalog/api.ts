import { apiRequest } from '../../api/client'
import type {
  AuditEntry, CatalogStatus, ItemType, ItemTypePayload, LaundryService, PageResponse,
  PriceList, PriceListDetail, PriceListStatus, PriceRule, PriceRulePayload, PricingPreview,
  ProcessingType, ServicePayload, UnitType,
} from './types'

function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  const serialized = query.toString()
  return serialized ? `?${serialized}` : ''
}

export const catalogApi = {
  services: (params: { page?: number; size?: number; search?: string; status?: CatalogStatus; processingType?: ProcessingType; unitType?: UnitType }) =>
    apiRequest<PageResponse<LaundryService>>(`/api/services${queryString(params)}`),
  createService: (body: ServicePayload) => apiRequest<LaundryService>('/api/services', { method: 'POST', body }),
  updateService: (id: number, body: ServicePayload) => apiRequest<LaundryService>(`/api/services/${id}`, { method: 'PUT', body }),
  serviceStatus: (id: number, status: CatalogStatus, version: number) =>
    apiRequest<LaundryService>(`/api/services/${id}/status`, { method: 'PATCH', body: { status, version } }),

  itemTypes: () => apiRequest<ItemType[]>('/api/item-types/tree'),
  createItemType: (body: ItemTypePayload) => apiRequest<ItemType>('/api/item-types', { method: 'POST', body }),
  updateItemType: (id: number, body: ItemTypePayload) => apiRequest<ItemType>(`/api/item-types/${id}`, { method: 'PUT', body }),
  itemTypeStatus: (id: number, status: CatalogStatus, version: number) =>
    apiRequest<ItemType>(`/api/item-types/${id}/status`, { method: 'PATCH', body: { status, version } }),

  priceLists: (params: { page?: number; size?: number; search?: string; branchId?: number; status?: PriceListStatus }) =>
    apiRequest<PageResponse<PriceList>>(`/api/price-lists${queryString(params)}`),
  priceList: (id: number) => apiRequest<PriceListDetail>(`/api/price-lists/${id}`),
  createPriceList: (body: { name: string; description?: string; branchId: number; currency: string; effectiveFrom: string; effectiveTo?: string }) =>
    apiRequest<PriceList>('/api/price-lists', { method: 'POST', body }),
  updatePriceList: (id: number, body: { name: string; description?: string; branchId: number; currency: string; effectiveFrom: string; effectiveTo?: string; version: number }) =>
    apiRequest<PriceList>(`/api/price-lists/${id}`, { method: 'PUT', body }),
  duplicatePriceList: (id: number, body: { name: string; effectiveFrom: string; effectiveTo?: string }) =>
    apiRequest<PriceListDetail>(`/api/price-lists/${id}/duplicate`, { method: 'POST', body }),
  publishPriceList: (id: number, version: number, reason?: string) =>
    apiRequest<PriceListDetail>(`/api/price-lists/${id}/publish`, { method: 'POST', body: { version, reason } }),
  archivePriceList: (id: number, version: number, reason?: string) =>
    apiRequest<PriceList>(`/api/price-lists/${id}/archive`, { method: 'POST', body: { version, reason } }),
  addRule: (priceListId: number, body: PriceRulePayload) =>
    apiRequest<PriceRule>(`/api/price-lists/${priceListId}/rules`, { method: 'POST', body }),
  updateRule: (priceListId: number, ruleId: number, body: PriceRulePayload) =>
    apiRequest<PriceRule>(`/api/price-lists/${priceListId}/rules/${ruleId}`, { method: 'PUT', body }),
  deleteRule: (priceListId: number, ruleId: number, rowVersion: number) =>
    apiRequest<void>(`/api/price-lists/${priceListId}/rules/${ruleId}?rowVersion=${rowVersion}`, { method: 'DELETE' }),
  preview: (body: {
    branchId: number; serviceId: number; itemTypeId?: number; sharingMode: string;
    quantity: number; effectiveAt: string; pricingMethod?: string; unitType?: string
  }) => apiRequest<PricingPreview>('/api/pricing/preview', { method: 'POST', body }),
  history: (priceListId: number) =>
    apiRequest<PageResponse<AuditEntry>>(`/api/price-lists/${priceListId}/history?size=50`),
}
