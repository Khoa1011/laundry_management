import { apiRequest } from '../../api/client'
import type { CustomerListResponse } from '../../api/types'
import type { LaundryService, PricingPreview, ServiceEligibility } from '../service-catalog/types'
import type { Order, OrderHistory, OrderItemPayload, OrderPage, OrderStatus } from './types'

const qs=(values:Record<string,string|number|undefined>)=>{const p=new URLSearchParams();Object.entries(values).forEach(([k,v])=>{if(v!==undefined&&v!=='')p.set(k,String(v))});return p.toString()?`?${p}`:''}
export const orderKeys={all:['orders'] as const,list:(branchId:number|null,status?:OrderStatus,search?:string,page=0)=>['orders','list',branchId,status,search,page] as const,detail:(id:number)=>['orders','detail',id] as const,history:(id:number)=>['orders','history',id] as const}
export const orderApi={
  list:(p:{branchId:number;page?:number;size?:number;status?:OrderStatus;search?:string})=>apiRequest<OrderPage>(`/api/orders${qs(p)}`),
  get:(id:number,branchId:number)=>apiRequest<Order>(`/api/orders/${id}`,{branchId}),
  create:(body:{branchId:number;customerId?:number;guestName?:string;guestPhone?:string;promisedAt?:string;note?:string;items:OrderItemPayload[]})=>apiRequest<Order>('/api/orders',{method:'POST',body}),
  update:(id:number,branchId:number,body:{version:number;promisedAt?:string;note?:string;items?:OrderItemPayload[]})=>apiRequest<Order>(`/api/orders/${id}`,{method:'PATCH',branchId,body}),
  transition:(id:number,branchId:number,action:'start-processing'|'mark-ready'|'complete',version:number)=>apiRequest<Order>(`/api/orders/${id}/${action}`,{method:'POST',branchId,body:{version}}),
  reasoned:(id:number,branchId:number,action:'cancel'|'reopen',version:number,reason:string)=>apiRequest<Order>(`/api/orders/${id}/${action}`,{method:'POST',branchId,body:{version,reason}}),
  history:(id:number,branchId:number)=>apiRequest<OrderHistory[]>(`/api/orders/${id}/history`,{branchId}),
  customers:(branchId:number,search:string)=>apiRequest<CustomerListResponse['items']>(`/api/customers/counter-search${qs({branchId,query:search})}`),
  services:()=>apiRequest<{items:LaundryService[]}>('/api/services?size=100&status=ACTIVE'),
  eligibility:(serviceId:number)=>apiRequest<ServiceEligibility>(`/api/services/${serviceId}/eligibility`),
  preview:(branchId:number,item:OrderItemPayload)=>apiRequest<PricingPreview>('/api/pricing/preview',{method:'POST',body:{branchId,...item,effectiveAt:new Date().toISOString()}}),
}
