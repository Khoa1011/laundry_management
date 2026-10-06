import { apiRequest } from '../../api/client'
import type { BatchFilterOptions, BatchHistory, BatchPage, BatchReference, BatchStats, CandidatePage, WashBatch, WashBatchStatus } from './types'

type QueryValue=string|number|boolean|readonly number[]|undefined
const qs=(values:Record<string,QueryValue>)=>{const p=new URLSearchParams();Object.entries(values).forEach(([k,v])=>{if(Array.isArray(v)){v.forEach(item=>p.append(k,String(item)))}else if(v!==undefined&&v!=='')p.set(k,String(v))});return p.toString()?`?${p}`:''}
export const batchKeys={all:['wash-batches'] as const,list:(branchId:number|null,status?:WashBatchStatus,search?:string,page=0,size=20,serviceId?:number,createdBy?:number,from?:string,to?:string,loadType?:string,warning?:string)=>['wash-batches','list',branchId,status,search,page,size,serviceId,createdBy,from,to,loadType,warning] as const,filterOptions:(branchId:number|null)=>['wash-batches','filter-options',branchId] as const,candidates:(branchId:number|null,search?:string,serviceId?:number,orderIds?:readonly number[])=>['wash-batches','candidates',branchId,search,serviceId,orderIds?.join(',')] as const,stats:(branchId:number|null)=>['wash-batches','stats',branchId] as const,detail:(id:number)=>['wash-batches','detail',id] as const,history:(id:number)=>['wash-batches','history',id] as const,byOrder:(id:number)=>['wash-batches','order',id] as const}
export const washBatchApi={
  list:(p:{branchId:number;status?:WashBatchStatus;search?:string;page?:number;size?:number;serviceId?:number;createdBy?:number;createdFrom?:string;createdTo?:string;loadType?:string;warning?:string})=>apiRequest<BatchPage>(`/api/wash-batches${qs(p)}`),
  filterOptions:(branchId:number)=>apiRequest<BatchFilterOptions>(`/api/wash-batches/filter-options${qs({branchId})}`),
  candidates:(p:{branchId:number;search?:string;serviceId?:number;orderIds?:readonly number[];page?:number;size?:number})=>apiRequest<CandidatePage>(`/api/wash-batches/candidates${qs(p)}`),
  stats:(branchId:number)=>apiRequest<BatchStats>(`/api/wash-batches/stats${qs({branchId})}`),
  get:(id:number,branchId:number)=>apiRequest<WashBatch>(`/api/wash-batches/${id}`,{branchId}),
  history:(id:number,branchId:number)=>apiRequest<BatchHistory[]>(`/api/wash-batches/${id}/history`,{branchId}),
  byOrder:(orderId:number,branchId:number)=>apiRequest<BatchReference[]>(`/api/wash-batches/by-order/${orderId}`,{branchId}),
  create:(body:{branchId:number;orderItemIds:number[];note?:string|null;markReady:boolean})=>apiRequest<WashBatch>('/api/wash-batches',{method:'POST',body}),
  addItems:(id:number,branchId:number,version:number,orderItemIds:number[])=>apiRequest<WashBatch>(`/api/wash-batches/${id}/add-items`,{method:'POST',branchId,body:{version,orderItemIds}}),
  removeItems:(id:number,branchId:number,version:number,orderItemIds:number[])=>apiRequest<WashBatch>(`/api/wash-batches/${id}/remove-items`,{method:'POST',branchId,body:{version,orderItemIds}}),
  updateNote:(id:number,branchId:number,version:number,note:string|null)=>apiRequest<WashBatch>(`/api/wash-batches/${id}/note`,{method:'PATCH',branchId,body:{version,note}}),
  markReady:(id:number,branchId:number,version:number)=>apiRequest<WashBatch>(`/api/wash-batches/${id}/mark-ready`,{method:'POST',branchId,body:{version}}),
  cancel:(id:number,branchId:number,version:number,reason:string)=>apiRequest<WashBatch>(`/api/wash-batches/${id}/cancel`,{method:'POST',branchId,body:{version,reason}}),
}
