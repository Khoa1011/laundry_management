export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED'
export type EmployeeAccountState = 'NO_ACCOUNT' | 'ACCOUNT_ACTIVE' | 'ACCOUNT_INACTIVE' | 'ACCOUNT_LOCKED'
export type AdministrativeVersion = 'V1' | 'V2'

export interface EmployeePosition {
  id: number
  code: string
  nameVi: string
  nameEn: string
  descriptionVi?: string | null
  descriptionEn?: string | null
  active: boolean
  sortOrder: number
  version: number
}

export interface EmployeeBranch {
  id: number
  code: string
  name: string
  primary: boolean
  active: boolean
  assignedAt: string
  unassignedAt?: string | null
}

export interface EmployeeAccountBranch {
  id: number
  code: string
  name: string
}

export interface EmployeeAccount {
  id: number
  username: string
  displayName: string
  status: EmployeeAccountState
  branchAccess: EmployeeAccountBranch[]
}

export interface EmployeeListItem {
  id: number
  employeeCode: string
  fullName: string
  phone?: string | null
  email?: string | null
  hireDate: string
  status: EmployeeStatus
  position: EmployeePosition
  primaryBranch?: EmployeeBranch | null
  activeBranchCount: number
  account?: EmployeeAccount | null
  version: number
  updatedAt: string
}

export interface EmployeeDetail extends Omit<EmployeeListItem, 'primaryBranch' | 'activeBranchCount'> {
  birthDate?: string | null
  address?: string | null
  administrativeVersion?: AdministrativeVersion | null
  province?: string | null
  provinceCode?: number | null
  district?: string | null
  districtCode?: number | null
  ward?: string | null
  wardCode?: number | null
  branches: EmployeeBranch[]
  createdAt: string
}

export interface EmployeeSelfProfile {
  id: number
  employeeCode: string
  fullName: string
  phone?: string | null
  email?: string | null
  birthDate?: string | null
  address?: string | null
  administrativeVersion?: AdministrativeVersion | null
  province?: string | null
  provinceCode?: number | null
  district?: string | null
  districtCode?: number | null
  ward?: string | null
  wardCode?: number | null
  hireDate: string
  status: EmployeeStatus
  position: EmployeePosition
  branches: EmployeeBranch[]
  accountStatus: EmployeeAccountState
  version: number
  updatedAt: string
}

export interface EmployeeListResponse {
  items: EmployeeListItem[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  sort: Array<{ property: string; direction: string }>
}

export interface EmployeeInput {
  fullName: string
  phone?: string
  email?: string
  birthDate?: string
  address?: string
  administrativeVersion?: AdministrativeVersion
  province?: string
  provinceCode?: number
  district?: string
  districtCode?: number
  ward?: string
  wardCode?: number
  hireDate: string
  positionId: number
  status: 'ACTIVE' | 'INACTIVE'
  branchIds: number[]
  primaryBranchId: number
  linkedUserId?: number
}

export interface BranchOption {
  id: number
  code: string
  name: string
}

export type AccountOption = EmployeeAccount

export interface AccountOptionList {
  items: AccountOption[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface EmployeeAuditItem {
  id: number
  action: string
  oldValue: Record<string, unknown>
  newValue: Record<string, unknown>
  reason?: string | null
  branch?: BranchOption | null
  actor: { id: number; displayName: string }
  createdAt: string
}

export interface EmployeeAuditList {
  items: EmployeeAuditItem[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
