import { apiRequest } from '../../api/client'
import type { PricingPreview } from '../service-catalog/types'
import type { IntakeCustomer, IntakeItemType, IntakeScanResult, IntakeService, Order, OrderBag, OrderFilterOptions, OrderHistory, OrderItemNoteUpdate, OrderItemPayload, OrderPage, OrderStatus } from './types'

const qs=(values:Record<string,string|number|boolean|undefined>)=>{const p=new URLSearchParams();Object.entries(values).forEach(([k,v])=>{if(v!==undefined&&v!=='')p.set(k,String(v))});return p.toString()?`?${p}`:''}
export const orderKeys={all:['orders'] as const,list:(branchId:number|null,status?:OrderStatus,search?:string,page=0,size=20,from?:string,to?:string,serviceId?:number,due?:string)=>['orders','list',branchId,status,search,page,size,from,to,serviceId,due] as const,filterOptions:(branchId:number|null)=>['orders','filter-options',branchId] as const,detail:(id:number)=>['orders','detail',id] as const,history:(id:number)=>['orders','history',id] as const}
export const orderApi={
  list:(p:{branchId:number;page?:number;size?:number;status?:OrderStatus;search?:string;from?:string;to?:string;serviceId?:number;promisedFrom?:string;promisedTo?:string;promisedMissing?:boolean;overdueOnly?:boolean})=>apiRequest<OrderPage>(`/api/orders${qs(p)}`),
  filterOptions:(branchId:number)=>apiRequest<OrderFilterOptions>(`/api/orders/filter-options${qs({branchId})}`),
  get:(id:number,branchId:number)=>apiRequest<Order>(`/api/orders/${id}`,{branchId}),
  create:(body:{branchId:number;customerId?:number;guestName?:string;guestPhone?:string;promisedAt?:string;note?:string;items:OrderItemPayload[];bagCount:number})=>apiRequest<Order>('/api/orders',{method:'POST',body}),
  requestBagPrint:(orderId:number,bagId:number,branchId:number)=>apiRequest<OrderBag>(`/api/orders/${orderId}/bags/${bagId}/print-requests`,{method:'POST',branchId}),
  update:(id:number,branchId:number,body:{version:number;promisedAt?:string|null;note?:string|null;items?:OrderItemPayload[];itemNoteUpdates?:OrderItemNoteUpdate[]})=>apiRequest<Order>(`/api/orders/${id}`,{method:'PATCH',branchId,body}),
  transition:(id:number,branchId:number,action:'start-processing'|'mark-ready'|'complete',version:number)=>apiRequest<Order>(`/api/orders/${id}/${action}`,{method:'POST',branchId,body:{version}}),
  reasoned:(id:number,branchId:number,action:'cancel'|'reopen',version:number,reason:string)=>apiRequest<Order>(`/api/orders/${id}/${action}`,{method:'POST',branchId,body:{version,reason}}),
  history:(id:number,branchId:number)=>apiRequest<OrderHistory[]>(`/api/orders/${id}/history`,{branchId}),
  customers:(branchId:number,search:string)=>apiRequest<IntakeCustomer[]>(`/api/orders/intake/customers${qs({branchId,query:search})}`),
  scan:(branchId:number,code:string)=>apiRequest<IntakeScanResult>(`/api/orders/intake/scan${qs({branchId,code})}`),
  services:(branchId:number)=>apiRequest<IntakeService[]>(`/api/orders/intake/services${qs({branchId})}`),
  eligibility:(branchId:number,serviceId:number)=>apiRequest<IntakeItemType[]>(`/api/orders/intake/services/${serviceId}/items${qs({branchId})}`),
  preview:(branchId:number,item:OrderItemPayload)=>apiRequest<PricingPreview>('/api/orders/intake/quote',{method:'POST',body:{branchId,...item}}),
}
