import type { BranchAccess, PageResponse } from '../../api/types'

export type AccessStatus = 'ACTIVE' | 'INACTIVE'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type OverrideEffect = 'ALLOW' | 'DENY'

export interface Permission {
  id: number
  code: string
  module: string
  resource: string
  action: string
  nameVi: string
  nameEn: string
  descriptionVi?: string | null
  descriptionEn?: string | null
  riskLevel: RiskLevel
  displayOrder: number
  status: AccessStatus
}

export interface PermissionModule {
  module: string
  nameVi: string
  nameEn: string
  displayOrder: number
  permissions: Permission[]
}

export interface Role {
  id: number
  code: string
  displayName: string
  description?: string | null
  nameVi: string
  nameEn: string
  descriptionVi?: string | null
  descriptionEn?: string | null
  status: AccessStatus
  system: boolean
  version: number
  assignedUsers: number
  permissionCount: number
  createdAt: string
  updatedAt: string
  createdBy?: UserReference | null
  updatedBy?: UserReference | null
}

export interface UserReference {
  id: number
  displayName: string
}

export interface RoleMatrix {
  role: Role
  permissionCodes: string[]
  modules: PermissionModule[]
  version: number
  assignedUserCount: number
  highRiskPermissionCount: number
}

export interface RoleSummary {
  id: number
  code: string
  displayName: string
  nameVi: string
  nameEn: string
  status: AccessStatus
  system: boolean
}

export interface AccessUser {
  id: number
  username: string
  displayName: string
  status: AccessStatus
  primaryRole?: RoleSummary | null
  branches: BranchAccess[]
  overrideCount: number
  authorizationVersion: number
  accessVersion: number
  updatedAt: string
}

export interface PermissionOverride {
  permissionCode: string
  effect: OverrideEffect
  reason: string
  effectiveFrom?: string | null
  effectiveTo?: string | null
  status: AccessStatus
  version: number
}

export interface PermissionDecision {
  permissionCode: string
  effective: boolean
  source: 'ROLE' | 'USER_ALLOW' | 'USER_DENY' | 'NONE'
  roleCode?: string | null
  overridesRole: boolean
  reason?: string | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  riskLevel: RiskLevel
  nameVi: string
  nameEn: string
  module: string
}

export interface UserAccess {
  user: AccessUser
  rolePermissions: string[]
  overrides: PermissionOverride[]
  effectivePermissions: string[]
  decisions: PermissionDecision[]
  authorizationVersion: number
  version: number
}

export interface AccessAudit {
  id: number
  actorUserId: number
  actorDisplayName: string
  targetType: string
  targetId: number
  action: string
  permissionCode?: string | null
  oldValue?: string | null
  newValue?: string | null
  reason?: string | null
  branch?: BranchAccess | null
  createdAt: string
}

export type RolePage = PageResponse<Role>
export type UserPage = PageResponse<AccessUser>
export type AuditPage = PageResponse<AccessAudit>
