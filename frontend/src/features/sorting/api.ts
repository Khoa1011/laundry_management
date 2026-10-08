import { apiRequest } from '../../api/client'
import type { BagContext, ColorGroup, GroupDraft, ProcessingGroup, WaitingFilterOptions, WaitingPage, WaitingStats, WashMode } from './types'

const query = (params:Record<string,string|number|boolean|undefined>) => {
  const values = new URLSearchParams()
  Object.entries(params).forEach(([key,value]) => { if (value !== undefined && value !== '') values.set(key,String(value)) })
  return `?${values}`
}
export const sortingKeys = { all:['sorting'] as const, waiting:(branchId:number|null,params:object)=>['sorting','waiting',branchId,params] as const, stats:(branchId:number|null)=>['sorting','stats',branchId] as const }
export const sortingApi = {
  scan:(branchId:number,code:string)=>apiRequest<BagContext>(`/api/sorting/scan${query({branchId,code})}`),
  confirm:(branchId:number,bagId:number,bagVersion:number,groups:GroupDraft[])=>apiRequest<BagContext>(`/api/sorting/bags/${bagId}/confirm`,{method:'POST',branchId,body:{bagVersion,groups}}),
  reopen:(branchId:number,bagId:number,bagVersion:number,reason:string)=>apiRequest<BagContext>(`/api/sorting/bags/${bagId}/reopen`,{method:'POST',branchId,body:{bagVersion,reason}}),
  print:(branchId:number,groupId:number)=>apiRequest<ProcessingGroup>(`/api/sorting/groups/${groupId}/print-requests`,{method:'POST',branchId}),
  waiting:(params:{branchId:number;search?:string;serviceId?:number;itemTypeId?:number;color?:ColorGroup;washMode?:WashMode;separateWash?:boolean;promisedFrom?:string;promisedTo?:string;page:number;size:number})=>apiRequest<WaitingPage>(`/api/sorting/waiting${query(params)}`),
  stats:(branchId:number)=>apiRequest<WaitingStats>(`/api/sorting/waiting/stats${query({branchId})}`),
  filterOptions:(branchId:number)=>apiRequest<WaitingFilterOptions>(`/api/sorting/waiting/filter-options${query({branchId})}`),
}
