export type WashBatchStatus = 'DRAFT' | 'READY' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED'
export type SharingMode = 'ANY' | 'SHARED_STANDARD' | 'SHARED_PRIORITY' | 'PRIVATE_LOAD'
export type UnitType = 'KG' | 'ITEM' | 'PAIR' | 'SET' | 'LOAD' | 'FIXED'
export interface Actor { id:number;displayName:string }
export interface Quantity { unitType:UnitType;quantity:number }
export interface BatchCandidate { orderItemId:number;orderId:number;orderCode:string;orderStatus:string;customerName?:string;customerPhone?:string;serviceId:number;serviceCode:string;serviceName:string;itemTypeId:number;itemTypeCode:string;itemTypeName:string;sharingMode:SharingMode;quantity:number;unitType:UnitType;itemNote?:string;promisedAt?:string;orderCreatedAt:string;warnings:string[] }
export interface CandidatePage { items:BatchCandidate[];page:number;size:number;totalElements:number;totalPages:number }
export interface BatchItem extends BatchCandidate { batchItemId:number;active:boolean;addedAt:string;addedBy:Actor;removedAt?:string;removedBy?:Actor }
export interface BatchSummaryData { orderCount:number;itemCount:number;quantities:Quantity[] }
export interface WashBatch { id:number;batchCode:string;branch:{id:number;code:string;name:string};service:{id:number;code:string;name:string};status:WashBatchStatus;note?:string;version:number;summary:BatchSummaryData;items:BatchItem[];warnings:string[];createdAt:string;createdBy:Actor;updatedAt:string;updatedBy:Actor;readyAt?:string;readyBy?:Actor;cancelledAt?:string;cancelledBy?:Actor;cancelReason?:string }
export interface BatchListItem { id:number;batchCode:string;serviceName:string;status:WashBatchStatus;orderCount:number;itemCount:number;quantities:Quantity[];createdAt:string;createdBy:Actor;version:number }
export interface BatchPage { items:BatchListItem[];page:number;size:number;totalElements:number;totalPages:number }
export interface BatchStats { candidateCount:number;draftCount:number;readyCount:number }
export interface BatchHistory { id:number;action:string;fromStatus?:WashBatchStatus;toStatus?:WashBatchStatus;reason?:string;changedFields?:Record<string,unknown>;actor:Actor;createdAt:string }
export interface BatchReference { id:number;batchCode:string;status:WashBatchStatus;serviceName:string;active:boolean;createdAt:string }
