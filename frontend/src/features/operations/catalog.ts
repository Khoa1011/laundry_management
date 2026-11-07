import { PERMISSION_CODES as P, type PermissionCode } from '../../auth/permissionCodes.generated'

export type Module = 'inventory' | 'finance'
export type FieldDefinition = {
  key: string
  kind?: 'text' | 'email' | 'tel' | 'textarea' | 'decimal' | 'money' | 'boolean' | 'choice' | 'reference'
  required?: boolean
  max?: number
  choices?: string[]
  reference?: string
  readPermission?: PermissionCode
  immutable?: boolean
}
export type CatalogDefinition = { key: string; read: PermissionCode; manage: PermissionCode; fields: FieldDefinition[] }
export const catalogs: Record<Module, CatalogDefinition[]> = {
  inventory: [
    { key: 'items', read: P.INVENTORY_ITEM_READ, manage: P.INVENTORY_ITEM_MANAGE, fields: [
      { key: 'categoryId', kind: 'reference', reference: '/inventory/categories', readPermission: P.INVENTORY_CATEGORY_READ, required: true },
      { key: 'baseUnitId', kind: 'reference', reference: '/inventory/units', readPermission: P.INVENTORY_UNIT_READ, required: true, immutable: true },
      { key: 'supplierId', kind: 'reference', reference: '/inventory/suppliers', readPermission: P.INVENTORY_SUPPLIER_READ },
      { key: 'description', kind: 'textarea', max: 1000 }, { key: 'referencePrice', kind: 'money' },
      { key: 'minimumStock', kind: 'decimal', required: true }, { key: 'maximumStock', kind: 'decimal' },
      { key: 'trackLots', kind: 'boolean' }, { key: 'trackExpiry', kind: 'boolean' },
    ] },
    { key: 'warehouses', read: P.INVENTORY_WAREHOUSE_READ, manage: P.INVENTORY_WAREHOUSE_MANAGE, fields: [] },
    { key: 'categories', read: P.INVENTORY_CATEGORY_READ, manage: P.INVENTORY_CATEGORY_MANAGE, fields: [] },
    { key: 'units', read: P.INVENTORY_UNIT_READ, manage: P.INVENTORY_UNIT_MANAGE, fields: [{ key: 'dimension', kind: 'choice', choices: ['COUNT', 'MASS', 'VOLUME'], required: true, immutable: true }] },
    { key: 'conversions', read: P.INVENTORY_UNIT_READ, manage: P.INVENTORY_UNIT_MANAGE, fields: [
      { key: 'itemId', kind: 'reference', reference: '/inventory/items', readPermission: P.INVENTORY_ITEM_READ, required: true, immutable: true },
      { key: 'inputUnitId', kind: 'reference', reference: '/inventory/units', readPermission: P.INVENTORY_UNIT_READ, required: true },
      { key: 'factor', kind: 'decimal', required: true },
    ] },
    { key: 'suppliers', read: P.INVENTORY_SUPPLIER_READ, manage: P.INVENTORY_SUPPLIER_MANAGE, fields: [
      { key: 'phone', kind: 'tel', max: 30 }, { key: 'email', kind: 'email', max: 150 },
      { key: 'address', kind: 'textarea', max: 500 }, { key: 'taxNumber', max: 50 },
      { key: 'contactName', max: 150 }, { key: 'materialGroups', kind: 'textarea', max: 500 },
    ] },
  ],
  finance: [
    { key: 'accounts', read: P.FINANCE_ACCOUNT_READ, manage: P.FINANCE_ACCOUNT_MANAGE, fields: [{ key: 'accountType', kind: 'choice', choices: ['CASH', 'BANK', 'EWALLET', 'OTHER'], required: true }] },
    { key: 'categories', read: P.FINANCE_CATEGORY_READ, manage: P.FINANCE_CATEGORY_MANAGE, fields: [{ key: 'direction', kind: 'choice', choices: ['INCOME', 'EXPENSE'], required: true, immutable: true }] },
  ],
}
export const modulePermissions = (module: Module) => [
  ...catalogs[module].map((c) => c.read),
  module === 'inventory' ? P.INVENTORY_SETTINGS_READ : P.FINANCE_SETTINGS_READ,
  module === 'inventory' ? P.INVENTORY_AUDIT_READ : P.FINANCE_AUDIT_READ,
]
export type CatalogRecord = {
  id: number; branchId: number; code: string; name: string; active: boolean; version: number; note: string | null
  createdAt: string; updatedAt: string
  [key: string]: string | number | boolean | null | undefined
}
export type Values = Record<string, string | boolean>
export type Policy = {
  branchId: number; version: number; approvalRequired: boolean; approvalThreshold: string
  allowNegative: boolean; defaultResourceId: number | null; valuationMethod: string | null; currency: string
}
