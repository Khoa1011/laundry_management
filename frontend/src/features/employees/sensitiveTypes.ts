export type CompensationStatus = 'ACTIVE' | 'SCHEDULED' | 'ENDED'
export interface SensitiveActor { id: number; displayName: string }
export interface Compensation {
  id: number; baseSalary: number; currency: string; effectiveFrom: string; effectiveTo?: string | null
  status: CompensationStatus; reason: string; version: number; actor: SensitiveActor; createdAt: string
}
export interface CompensationCurrent { current?: Compensation | null; scheduled?: Compensation | null }
export interface CompensationHistory { items: Compensation[]; page: number; size: number; totalElements: number; totalPages: number }
export interface CompensationInput { baseSalary: number; currency: string; effectiveFrom: string; reason: string }

export type IdentityType = 'CITIZEN_ID' | 'PASSPORT' | 'OTHER'
export type IdentityVerificationStatus = 'NOT_VERIFIED' | 'VERIFIED' | 'REJECTED'
export interface EmployeeIdentity {
  id: number; identityType: IdentityType; number: string; masked: boolean; issuedDate?: string | null
  issuedPlace?: string | null; expiresOn?: string | null; verificationStatus: IdentityVerificationStatus
  verificationReason?: string | null; verifiedAt?: string | null; version: number; updatedAt: string
}
export interface IdentityInput {
  identityType: IdentityType; number: string; issuedDate?: string; issuedPlace?: string
  expiresOn?: string; version?: number
}

export type EmployeeDocumentType = 'CONTRACT' | 'IDENTITY_COPY' | 'CERTIFICATE' | 'OTHER'
export type EmployeeDocumentStatus = 'ACTIVE' | 'REPLACED' | 'DELETED'
export interface EmployeeDocument {
  id: number; documentType: EmployeeDocumentType; originalFilename: string; contentType: string
  sizeBytes: number; description?: string | null; documentVersion: number; status: EmployeeDocumentStatus
  replacesDocumentId?: number | null; deletedAt?: string | null; deleteReason?: string | null
  recordVersion: number; actor: SensitiveActor; createdAt: string
}
export interface EmployeeDocumentList { items: EmployeeDocument[]; page: number; size: number; totalElements: number; totalPages: number }
