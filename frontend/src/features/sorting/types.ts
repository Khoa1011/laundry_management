export type ColorGroup = 'WHITE'|'LIGHT'|'DARK'|'COLORED'|'MIXED'|'UNKNOWN'
export type FabricCare = 'STANDARD'|'DELICATE'|'WOOL'|'DENIM'|'SYNTHETIC'|'BEDDING'|'MIXED'|'UNKNOWN'
export type WashMode = 'SERVICE_DEFAULT'|'NORMAL'|'GENTLE'|'HEAVY'|'HYGIENE'
export type TemperatureProfile = 'SERVICE_DEFAULT'|'COLD'|'T30'|'T40'|'T60'|'T90'
export type DetergentProfile = 'DEFAULT'|'HYPOALLERGENIC'|'NO_FRAGRANCE'|'CUSTOMER_SUPPLIED'|'NONE'
export type SoftenerProfile = 'DEFAULT'|'NONE'|'NO_FRAGRANCE'|'CUSTOMER_SUPPLIED'
export type HygieneLevel = 'STANDARD'|'HIGH'
export type DryingInstruction = 'TUMBLE_NORMAL'|'TUMBLE_LOW'|'HANG_DRY'|'DO_NOT_DRY'
export type GroupStatus = 'WAITING'|'VOIDED'
export interface SortingItem {
  id:number;serviceCode:string;serviceName:string;itemTypeCode:string;itemTypeName:string
  serviceId:number;itemTypeId:number;unitType:string;sharingMode:string;requiresSeparateWash:boolean
  quantity:number;alreadyAllocatedQuantity:number;remainingQuantity:number
}
export interface GroupDraft {
  orderItemId:number;quantity:number;colorGroup:ColorGroup;fabricCare:FabricCare;washMode:WashMode
  temperatureProfile:TemperatureProfile;detergentProfile:DetergentProfile;softenerProfile:SoftenerProfile
  hygieneLevel:HygieneLevel;separateWash:boolean;dryingInstruction:DryingInstruction;note:string
}
export interface ProcessingGroup extends GroupDraft {
  id:number;groupCode:string;barcode:string;orderBagId:number;orderCode:string;bagCode:string
  customerName?:string|null;serviceName:string;itemTypeName:string;serviceId:number;itemTypeId:number;unitType:string
  status:GroupStatus;createdAt:string;promisedAt?:string|null;lastPrintRequestedAt?:string|null
  shareable:boolean
  printRequestCount:number;voidedAt?:string|null;voidReason?:string|null;version:number
}
export interface BagContext {
  bagId:number;bagCode:string;bagSequence:number;activeBagCount:number;lastUnsortedBag:boolean;bagStatus:'RECEIVED'|'SORTED'|'VOIDED'|'LEGACY_UNVERIFIED'
  bagVersion:number;bagCreatedAt:string;bagVoidReason?:string|null;orderId:number;orderCode:string
  orderStatus:string;customerName?:string|null;promisedAt?:string|null;items:SortingItem[];groups:ProcessingGroup[]
}
export interface WaitingPage {items:ProcessingGroup[];page:number;size:number;totalElements:number;totalPages:number}
export interface WaitingStats {total:number;shareable:number;separate:number}
export interface WaitingFilterOptions {services:Array<{id:number;label:string}>;itemTypes:Array<{id:number;label:string}>}
