import { PERMISSION_CODES as P, type PermissionCode } from '../../auth/permissionCodes.generated'
export type Kind = 'RECEIPT' | 'ISSUE' | 'TRANSFER' | 'STOCKTAKE' | 'ADJUSTMENT'
export const kinds: Record<string, Kind> = { receipts: 'RECEIPT', issues: 'ISSUE', transfers: 'TRANSFER', stocktakes: 'STOCKTAKE', adjustments: 'ADJUSTMENT' }
export const createPermissions = { RECEIPT: P.INVENTORY_RECEIPT_CREATE, ISSUE: P.INVENTORY_ISSUE_CREATE, TRANSFER: P.INVENTORY_TRANSFER_CREATE, STOCKTAKE: P.INVENTORY_STOCKTAKE_CREATE, ADJUSTMENT: P.INVENTORY_ADJUSTMENT_CREATE }
export const stockPermissions = [P.INVENTORY_OVERVIEW_READ, P.INVENTORY_STOCK_READ, P.INVENTORY_DOCUMENT_READ, P.INVENTORY_REPORT_READ, ...Object.values(createPermissions)]
export interface Line {
  itemId: number | null; quantity: string; unitPrice: string | null; conversionId: number | null
  discount: string; tax: string; lotCode: string | null; expiryDate: string | null
  destinationItemId: number | null; balanceVersion: number | null; increase: number
}
export interface Input {
  branchId: number; kind: Kind; warehouseId: number | null; destinationBranchId: number | null
  destinationWarehouseId: number | null; supplierId: number | null; businessAt: string; issueType: string
  note: string; reason: string; charges: string; draft: boolean; version?: number; lines: Line[]
}
export interface Document {
  id: number; code: string; kind: Kind; status: string; version: number; branchId: number
  warehouseId: number; warehouseName: string; supplierName: string | null; businessAt: string; totalValue: string | null
  subtotal?: string | null; discountTotal?: string | null; taxTotal?: string | null
  quantities: Record<string, string>; createdBy: number; actorName?: string; updatedBy: number; createdAt: string; updatedAt: string
  input: Input; lines: Array<Line & { itemName: string; baseUnit: string; inputUnit: string; factor: string; baseQuantity: string; lineValue: string | null; availableQuantity: string; difference?: string }>
  transit?: Array<{ lineNumber: number; dispatched: string; received: string; returned: string; remainingValue: string | null }>
}
export interface Balance { warehouseId: number; warehouseName: string; itemId: number; itemName: string; itemCode: string; baseUnit: string; quantity: string; stockValue: string | null; minimumStock: string; version: number; averageCost: string | null }
export interface Ledger { itemId?: number; id: number; documentId: number; revision: number; code: string; kind: Kind; warehouseName: string; itemName: string; baseUnit: string; lotCode: string | null; phase: string; quantityDelta: string; valueDelta: string | null; quantityAfter: string; valueAfter: string | null; recordedAt: string; actorId: number }
export interface Report { warehouseId: number; warehouseName: string; itemId: number; itemName: string; itemCode: string; baseUnit: string; openingQuantity: string; incomingQuantity: string; outgoingQuantity: string; adjustmentIncrease: string; adjustmentDecrease: string; closingQuantity: string; openingValue: string | null; incomingValue: string | null; outgoingValue: string | null; adjustmentValue: string | null; closingValue: string | null }
export interface Dashboard {
  summary: { itemCount: number; stockValue: string | null; outOfStock: number; lowStock: number }
  unitTotals: Array<{ baseUnitId: number; baseUnit: string; quantity: string }>; lowStock: Array<Balance>
  transit: Array<{ baseUnitId: number; baseUnit: string; quantity: string; transitValue: string | null }>
  flows: Array<{ kind: Kind; baseUnitId: number; baseUnit: string; incomingQuantity: string; outgoingQuantity: string; incomingValue: string | null; outgoingValue: string | null }>
  expiringLots: Array<{ warehouseName: string; itemName: string; lotCode: string; expiryDate: string; quantity: string }>
  series: Array<{ day: string; baseUnitId: number; baseUnit: string; incomingQuantity: string; outgoingQuantity: string }>
  periodValues: { receiptValue: string | null; issueValue: string | null }
  consumption: Array<{ itemId: number; itemName: string; baseUnit: string; quantity: string }>
  recentDocuments: Array<{ id: number; code: string; kind: Kind; status: string; businessAt: string }>
}
export interface Revision { id: number; revision: number; action: string; actorId: number; recordedAt: string; reason: string | null; beforeSnapshot: Document | null; snapshot: Document; effects: Ledger[] }
export type Filters = { warehouseId: string; itemId: string; categoryId: string; supplierId: string; search: string; from: string; to: string; status: string; sort: string }
export const emptyFilters: Filters = { warehouseId: '', itemId: '', categoryId: '', supplierId: '', search: '', from: '', to: '', status: '', sort: 'newest' }
export const emptyLine = (): Line => ({ itemId: null, quantity: '', unitPrice: null, conversionId: null, discount: '0', tax: '0', lotCode: null, expiryDate: null, destinationItemId: null, balanceVersion: null, increase: 1 })
export function decimal(value: string | number | null | undefined, english = false) {
  if (value === null || value === undefined) return '—'
  const [integer, fraction = ''] = String(value).split('.')
  const group = english ? ',' : '.'; const point = english ? '.' : ','
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, group) + (fraction.replace(/0+$/, '') ? point + fraction.replace(/0+$/, '') : '')
}

export const stockPages: Array<{ path: string; permission: PermissionCode }> = [
  { path: 'dashboard', permission: P.INVENTORY_OVERVIEW_READ },
  ...Object.keys(kinds).map((path) => ({ path, permission: P.INVENTORY_DOCUMENT_READ })),
  { path: 'balances', permission: P.INVENTORY_STOCK_READ },
  { path: 'ledger', permission: P.INVENTORY_STOCK_READ },
  { path: 'reports', permission: P.INVENTORY_REPORT_READ },
]
