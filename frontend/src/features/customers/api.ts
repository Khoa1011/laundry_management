import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../../api/client'
import type { AddressInput, AddressStatus, CustomerActivityList, CustomerAddress, CustomerDetail, CustomerInput, CustomerListResponse, CustomerSource, CustomerStatus, CustomerType } from '../../api/types'

export interface CustomerFilters {
  page: number
  size: number
  search: string
  status: '' | CustomerStatus
  customerType: '' | CustomerType
  source: '' | CustomerSource
  sort: string
  branchId: number
}

function customerListPath(filters: CustomerFilters) {
  const params = new URLSearchParams({ page: String(filters.page), size: String(filters.size), branchId: String(filters.branchId) })
  if (filters.search) params.set('search', filters.search)
  if (filters.status) params.set('status', filters.status)
  if (filters.customerType) params.set('customerType', filters.customerType)
  if (filters.source) params.set('source', filters.source)
  if (filters.sort) params.set('sort', filters.sort)
  return `/api/customers?${params.toString()}`
}

export function useCustomers(filters: CustomerFilters) {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: ({ signal }) => apiRequest<CustomerListResponse>(customerListPath(filters), { signal }),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  })
}

export function useCustomer(customerId: number | null, branchId: number | null) {
  return useQuery({
    queryKey: ['customer', branchId, customerId],
    queryFn: ({ signal }) => apiRequest<CustomerDetail>(`/api/customers/${customerId}`, { branchId: branchId ?? undefined, signal }),
    enabled: customerId !== null && branchId !== null,
    staleTime: 10_000,
  })
}

export function useCustomerActivities(customerId: number, branchId: number, page: number, enabled: boolean) {
  return useQuery({
    queryKey: ['customer-activities', branchId, customerId, page],
    queryFn: ({ signal }) => apiRequest<CustomerActivityList>(`/api/customers/${customerId}/activities?page=${page}&size=10`, { branchId, signal }),
    enabled,
  })
}

export function useCreateCustomer() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomerInput) => apiRequest<CustomerDetail>('/api/customers', { method: 'POST', body: input }),
    onSuccess: (customer) => {
      void client.invalidateQueries({ queryKey: ['customers'] })
      client.setQueryData(['customer', customer.branch.id, customer.id], customer)
    },
  })
}

export function useUpdateCustomer(customerId: number, branchId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomerInput & { version: number }) => apiRequest<CustomerDetail>(`/api/customers/${customerId}`, { method: 'PUT', branchId, body: input }),
    onSuccess: (customer) => {
      client.setQueryData(['customer', branchId, customerId], customer)
      void client.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useChangeCustomerStatus(customerId: number, branchId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ status, version }: { status: CustomerStatus; version: number }) => apiRequest<CustomerDetail>(`/api/customers/${customerId}/status`, { method: 'PATCH', branchId, body: { status, version } }),
    onSuccess: (customer) => {
      client.setQueryData(['customer', branchId, customerId], customer)
      void client.invalidateQueries({ queryKey: ['customers'] })
      void client.invalidateQueries({ queryKey: ['customer-activities', branchId, customerId] })
    },
  })
}

function invalidateCustomer(client: ReturnType<typeof useQueryClient>, customerId: number, branchId: number) {
  void client.invalidateQueries({ queryKey: ['customer', branchId, customerId] })
  void client.invalidateQueries({ queryKey: ['customer-activities', branchId, customerId] })
}

export function useCreateAddress(customerId: number, branchId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: AddressInput) => apiRequest<CustomerAddress>(`/api/customers/${customerId}/addresses`, { method: 'POST', branchId, body: input }),
    onSuccess: () => invalidateCustomer(client, customerId, branchId),
  })
}

export function useUpdateAddress(customerId: number, branchId: number, addressId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: AddressInput & { version: number }) => apiRequest<CustomerAddress>(`/api/customers/${customerId}/addresses/${addressId}`, { method: 'PUT', branchId, body: input }),
    onSuccess: () => invalidateCustomer(client, customerId, branchId),
  })
}

export function useSetDefaultAddress(customerId: number, branchId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ addressId, version }: { addressId: number; version: number }) => apiRequest<CustomerAddress>(`/api/customers/${customerId}/addresses/${addressId}/default`, { method: 'PATCH', branchId, body: { version } }),
    onSuccess: () => invalidateCustomer(client, customerId, branchId),
  })
}

export function useChangeAddressStatus(customerId: number, branchId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ addressId, status, version, replacementAddressId }: { addressId: number; status: AddressStatus; version: number; replacementAddressId?: number }) => apiRequest<CustomerAddress>(`/api/customers/${customerId}/addresses/${addressId}/status`, { method: 'PATCH', branchId, body: { status, version, replacementAddressId } }),
    onSuccess: () => invalidateCustomer(client, customerId, branchId),
  })
}
