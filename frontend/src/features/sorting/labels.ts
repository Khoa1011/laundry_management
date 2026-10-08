import type { ColorGroup, DryingInstruction, FabricCare, WashMode } from './types'

export const colors: Array<[ColorGroup,string]> = [['UNKNOWN','Chưa rõ'],['WHITE','Trắng'],['LIGHT','Sáng'],['DARK','Tối'],['COLORED','Màu'],['MIXED','Hỗn hợp']]
export const cares: Array<[FabricCare,string]> = [['STANDARD','Tiêu chuẩn'],['DELICATE','Mỏng'],['WOOL','Len'],['DENIM','Jean'],['SYNTHETIC','Tổng hợp'],['BEDDING','Chăn ga'],['MIXED','Hỗn hợp'],['UNKNOWN','Chưa rõ']]
export const washes: Array<[WashMode,string]> = [['SERVICE_DEFAULT','Theo dịch vụ'],['NORMAL','Thông thường'],['GENTLE','Nhẹ'],['HEAVY','Mạnh'],['HYGIENE','Vệ sinh']]
export const drying: Array<[DryingInstruction,string]> = [['TUMBLE_NORMAL','Sấy thường'],['TUMBLE_LOW','Sấy nhẹ'],['HANG_DRY','Phơi'],['DO_NOT_DRY','Không sấy']]
export const temperatures = [['SERVICE_DEFAULT','Theo dịch vụ'],['COLD','Lạnh'],['T30','30°C'],['T40','40°C'],['T60','60°C'],['T90','90°C']] as const
export const detergents = [['DEFAULT','Mặc định'],['HYPOALLERGENIC','Dị ứng'],['NO_FRAGRANCE','Không hương'],['CUSTOMER_SUPPLIED','Khách mang'],['NONE','Không dùng']] as const
export const softeners = [['DEFAULT','Mặc định'],['NONE','Không dùng'],['NO_FRAGRANCE','Không hương'],['CUSTOMER_SUPPLIED','Khách mang']] as const
export const hygiene = [['STANDARD','Tiêu chuẩn'],['HIGH','Cao']] as const

export function unit(value:string) { return value === 'KG' ? 'kg' : value === 'PAIR' ? 'đôi' : value === 'SET' ? 'bộ' : 'món' }
export function amount(value:number) { return new Intl.NumberFormat('vi-VN', { maximumFractionDigits:3 }).format(value) }
export function colorText(value:ColorGroup) { return colors.find(([code]) => code === value)?.[1] ?? value }
export function careText(value:FabricCare) { return cares.find(([code]) => code === value)?.[1] ?? value }
export function washText(value:WashMode) { return washes.find(([code]) => code === value)?.[1] ?? value }
