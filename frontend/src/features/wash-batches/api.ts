import { apiRequest } from '../../api/client'
import type { BatchHistory, BatchPage, BatchReference, BatchStats, CandidatePage, WashBatch, WashBatchStatus } from './types'

const qs=(values:Record<string,string|number|undefined>)=>{const p=new URLSearchParams();Object.entries(values).forEach(([k,v])=>{if(v!==undefined&&v!=='')p.set(k,String(v))});return p.toString()?`?${p}`:''}
export const batchKeys={all:['wash-batches'] as const,list:(branchId:number|null,status?:WashBatchStatus,search?:string)=>['wash-batches','list',branchId,status,search] as const,candidates:(branchId:number|null,search?:string,serviceId?:number)=>['wash-batches','candidates',branchId,search,serviceId] as const,stats:(branchId:number|null)=>['wash-batches','stats',branchId] as const,detail:(id:number)=>['wash-batches','detail',id] as const,history:(id:number)=>['wash-batches','history',id] as const,byOrder:(id:number)=>['wash-batches','order',id] as const}
export const washBatchApi={
  list:(p:{branchId:number;status?:WashBatchStatus;search?:string;page?:number;size?:number})=>apiRequest<BatchPage>(`/api/wash-batches${qs(p)}`),
  candidates:(p:{branchId:number;search?:string;serviceId?:number;page?:number;size?:number})=>apiRequest<CandidatePage>(`/api/wash-batches/candidates${qs(p)}`),
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
