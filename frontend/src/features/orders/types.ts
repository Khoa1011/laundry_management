import type { PricingMethod, SharingMode, UnitType } from '../service-catalog/types'

export type OrderStatus = 'RECEIVED'|'PROCESSING'|'READY'|'COMPLETED'|'CANCELLED'|'REOPENED'
export interface OrderBag { id:number;bagCode:string;sequenceNumber:number;status:'RECEIVED'|'SORTED'|'LEGACY_UNVERIFIED'|'VOIDED';createdAt:string;lastPrintRequestedAt?:string|null;printRequestCount:number;voidedAt?:string|null;voidedBy?:{id:number;displayName:string}|null;voidReason?:string|null }
export interface OrderItem { id:number;serviceId:number;itemTypeId:number;serviceCode:string;serviceName:string;itemTypeCode:string;itemTypeName:string;pricingMethod:PricingMethod;unitType:UnitType;sharingMode:SharingMode;quantity:number;billableQuantity:number;lineAmount:number;note?:string;pricingSnapshot:Record<string,unknown>;quotedAt:string }
export interface Order { id:number;orderCode:string;branchId:number;branchCode:string;customerId?:number;customerName?:string;customerPhone?:string;status:OrderStatus;promisedAt?:string;note?:string;currency:string;totalAmount:number;items:OrderItem[];bags:OrderBag[];createdAt:string;createdBy:{id:number;displayName:string};updatedAt:string;updatedBy:{id:number;displayName:string};cancelledAt?:string;cancelledBy?:{id:number;displayName:string};cancelReason?:string;reopenedAt?:string;reopenedBy?:{id:number;displayName:string};reopenReason?:string;version:number }
export interface IntakeScanResult { type:'CUSTOMER'|'BAG'|'NOT_FOUND';customer?:IntakeCustomer;bagCode?:string }
export interface OrderListItem { id:number;orderCode:string;customerName?:string;customerPhone?:string;serviceSummary:string;totalAmount:number;currency:string;status:OrderStatus;promisedAt?:string;createdAt:string;version:number }
export interface OrderPage { items:OrderListItem[];page:number;size:number;totalElements:number;totalPages:number }
export interface OrderFilterOptions { services:Array<{id:number;label:string}> }
export interface OrderHistory { id:number;action:string;fromStatus?:OrderStatus;toStatus?:OrderStatus;reason?:string;changedFields?:Record<string,unknown>;source:string;actor:{id:number;displayName:string};createdAt:string }
export interface OrderItemPayload { serviceId:number;itemTypeId:number;sharingMode:SharingMode;priorityLevel?:number;quantity:number;note?:string }
export interface OrderItemNoteUpdate { itemId:number;note:string|null }
export interface IntakeCustomer { id:number;customerCode:string;fullName:string;phone:string }
export interface IntakeService { id:number;code:string;nameVi:string;defaultUnitType:UnitType;sharingAllowed:boolean }
export interface IntakeItemType { id:number;code:string;nameVi:string;defaultUnitType:UnitType }
