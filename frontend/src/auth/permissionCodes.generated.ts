// GENERATED FILE - DO NOT EDIT MANUALLY.
// Source: access-control/modules/*.yml
export const PERMISSION_CODES = {
  CUSTOMER_READ: 'customer.read',
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_UPDATE: 'customer.update',
  CUSTOMER_DEACTIVATE: 'customer.deactivate',
  CUSTOMER_ADDRESS_MANAGE: 'customer.address.manage',
  CUSTOMER_AUDIT_READ: 'customer.audit.read',
} as const

export type PermissionCode = typeof PERMISSION_CODES[keyof typeof PERMISSION_CODES]

export const ALL_PERMISSION_CODES: readonly PermissionCode[] = Object.values(PERMISSION_CODES)
