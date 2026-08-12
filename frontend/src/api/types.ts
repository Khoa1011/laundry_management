export type CustomerStatus = 'ACTIVE' | 'INACTIVE'
export type CustomerType = 'INDIVIDUAL' | 'BUSINESS'
export type CustomerSource =
  | 'WALK_IN'
  | 'REFERRAL'
  | 'FACEBOOK'
  | 'ZALO'
  | 'GOOGLE'
  | 'WEBSITE'
  | 'PARTNER'
  | 'OTHER'
export type AddressStatus = 'ACTIVE' | 'INACTIVE'
export type AdministrativeVersion = 'V1' | 'V2'

export interface BranchAccess {
  id: number
  code: string
  name: string
}

export interface CurrentUser {
  id: number
  username: string
  displayName: string
  roles: string[]
  permissions: PermissionCode[]
  branches: BranchAccess[]
  defaultBranchId: number
  authorizationVersion?: number
  status?: 'ACTIVE' | 'INACTIVE'
  primaryRole?: {
    id: number
    code: string
    nameVi: string
    nameEn: string
    status: 'ACTIVE' | 'INACTIVE'
    system: boolean
  } | null
}

export interface LoginResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  user: CurrentUser
}

export interface ApiProblem {
  title?: string
  status: number
  detail?: string
  errorCode?: string
  fieldErrors?: Record<string, string[]>
}

export interface CustomerListItem {
  id: number
  customerCode: string
  fullName: string
  phone: string
  email?: string | null
  customerType: CustomerType
  source?: CustomerSource | null
  status: CustomerStatus
  createdAt: string
  updatedAt: string
}

export interface PageResponse<T> {
  items: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface CustomerListResponse extends PageResponse<CustomerListItem> {
  sort: Array<{ property: string; direction: string }>
}

export interface CustomerAddress {
  id: number
  receiverName: string
  receiverPhone: string
  administrativeVersion?: AdministrativeVersion | null
  province?: string | null
  provinceCode?: number | null
  district?: string | null
  districtCode?: number | null
  ward?: string | null
  wardCode?: number | null
  addressLine: string
  deliveryNote?: string | null
  isDefault: boolean
  status: AddressStatus
  version: number
  createdAt: string
  updatedAt: string
}

export interface CustomerDetail extends CustomerListItem {
  birthDate?: string | null
  note?: string | null
  branch: BranchAccess
  addresses: CustomerAddress[]
  version: number
}

export interface AddressInput {
  receiverName: string
  receiverPhone: string
  administrativeVersion?: AdministrativeVersion
  province?: string
  provinceCode?: number
  district?: string
  districtCode?: number
  ward?: string
  wardCode?: number
  addressLine: string
  deliveryNote?: string
  isDefault: boolean
}

export interface CustomerInput {
  fullName: string
  phone: string
  email?: string
  birthDate?: string
  customerType: CustomerType
  source?: CustomerSource
  note?: string
  branchId?: number
  initialAddress?: AddressInput
}

export interface CustomerActivity {
  id: number
  entityType: string
  entityId: number
  action: string
  changedFields: Record<string, unknown>
  actor: { id: number; displayName: string }
  createdAt: string
}

export type CustomerActivityList = PageResponse<CustomerActivity>
import type { PermissionCode } from '../auth/permissionCodes.generated'
