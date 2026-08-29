export type CatalogStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
export type UnitType = 'KG' | 'ITEM' | 'PAIR' | 'SET' | 'LOAD' | 'FIXED'
export type ProcessingType = 'WASH_DRY' | 'WASH_ONLY' | 'DRY_ONLY' | 'DRY_CLEAN' | 'IRON' | 'SHOE_CLEANING' | 'STAIN_REMOVAL' | 'DELIVERY' | 'OTHER'
export type PricingMethod = 'BY_WEIGHT' | 'BY_ITEM' | 'BY_PAIR' | 'BY_SET' | 'FIXED' | 'PER_LOAD' | 'HYBRID' | 'QUANTITY_PACKAGE'
export type SharingMode = 'ANY' | 'SHARED_STANDARD' | 'SHARED_PRIORITY' | 'PRIVATE_LOAD'
export type TierCalculationMode = 'VOLUME' | 'PROGRESSIVE'
export type PriceListStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'ARCHIVED'
export type PriceRuleStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'ARCHIVED'

export interface Actor { id: number; name: string }
export interface Branch { id: number; code: string; name: string }

export interface LaundryService {
  id: number
  code: string
  nameVi: string
  nameEn?: string
  descriptionVi?: string
  descriptionEn?: string
  processingType: ProcessingType
  defaultUnitType: UnitType
  sharingAllowed: boolean
  estimatedMinutes?: number
  minimumQuantity?: number
  status: CatalogStatus
  createdAt: string
  updatedAt: string
  updatedBy: Actor
  version: number
  eligibleItemTypeCount: number
  relatedPriceRuleCount: number
}

export interface ServicePayload {
  nameVi: string
  nameEn?: string
  descriptionVi?: string
  descriptionEn?: string
  processingType: ProcessingType
  defaultUnitType: UnitType
  sharingAllowed: boolean
  estimatedMinutes?: number
  minimumQuantity?: number
  version?: number
}

export interface ItemType {
  id: number
  code: string
  parentId?: number
  nameVi: string
  nameEn?: string
  descriptionVi?: string
  descriptionEn?: string
  defaultUnitType?: UnitType
  effectiveUnitType?: UnitType
  inheritedUnit: boolean
  requiresSeparateWash: boolean
  defaultColorRisk?: string
  defaultHygieneLevel?: string
  sortOrder: number
  status: CatalogStatus
  createdAt: string
  updatedAt: string
  updatedBy: Actor
  version: number
  applicableServiceCount: number
  relatedPriceRuleCount: number
  children: ItemType[]
}

export interface ItemTypePayload {
  parentId?: number
  nameVi: string
  nameEn?: string
  descriptionVi?: string
  descriptionEn?: string
  defaultUnitType?: UnitType
  requiresSeparateWash: boolean
  defaultColorRisk?: string
  defaultHygieneLevel?: string
  sortOrder: number
  version?: number
}

export interface PriceList {
  id: number
  code: string
  name: string
  description?: string
  branch: Branch
  currency: string
  status: PriceListStatus
  effectiveFrom: string
  effectiveTo?: string
  ruleCount: number
  createdAt: string
  updatedAt: string
  updatedBy: Actor
  publishedAt?: string
  publishedBy?: Actor
  archivedAt?: string
  version: number
}

export interface PriceTier {
  id?: number
  fromQuantity: number
  toQuantity?: number
  unitPrice: number
  sortOrder: number
}

export interface PackagePrice {
  id?: number
  quantity: number
  totalPrice: number
  sortOrder: number
}

export interface PriceRule {
  id: number
  priceListId: number
  service: Pick<LaundryService, 'id' | 'code' | 'nameVi' | 'nameEn'>
  itemType?: Pick<ItemType, 'id' | 'code' | 'nameVi' | 'nameEn'>
  pricingMethod: PricingMethod
  unitType: UnitType
  sharingMode: SharingMode
  priorityLevel?: number
  basePrice?: number
  unitPrice?: number
  minimumQuantity?: number
  maximumQuantity?: number
  minimumCharge?: number
  includedQuantity?: number
  excessUnitPrice?: number
  tierCalculationMode?: TierCalculationMode
  rulePriority: number
  effectiveFrom: string
  effectiveTo?: string
  status: PriceRuleStatus
  versionNumber: number
  publishedAt?: string
  rowVersion: number
  tiers: PriceTier[]
  packagePrices: PackagePrice[]
}

export interface PriceRulePayload {
  serviceId: number
  itemTypeId?: number
  pricingMethod: PricingMethod
  unitType: UnitType
  sharingMode: SharingMode
  priorityLevel?: number
  basePrice?: number
  unitPrice?: number
  minimumQuantity?: number
  maximumQuantity?: number
  minimumCharge?: number
  includedQuantity?: number
  excessUnitPrice?: number
  tierCalculationMode?: TierCalculationMode
  rulePriority: number
  effectiveFrom: string
  effectiveTo?: string
  tiers: PriceTier[]
  packagePrices: PackagePrice[]
  rowVersion?: number
}

export interface PriceListDetail { priceList: PriceList; rules: PriceRule[] }
export interface PageResponse<T> { items: T[]; page: number; size: number; totalElements: number; totalPages: number }

export interface PricingPreview {
  currency: string
  priceListId: number
  priceListName: string
  priceRuleId: number
  priceRuleVersion: number
  serviceName: string
  itemTypeName?: string
  pricingMethod: PricingMethod
  unitType: UnitType
  sharingMode: SharingMode
  actualQuantity: number
  billableQuantity: number
  unitPrice?: number
  baseAmount: number
  surchargeAmount: number
  discountAmount: number
  finalAmount: number
  effectiveAt: string
  explanationCode: string
  explanation: string
  pricingComponents: PricingComponent[]
}

export interface PricingComponent {
  type: 'BASE' | 'UNIT' | 'EXCESS' | 'TIER' | 'MINIMUM_QUANTITY' | 'MINIMUM_CHARGE_ADJUSTMENT' | 'QUANTITY_PACKAGE'
  label: string
  quantity?: number
  unitPrice?: number
  amount: number
}

export interface ServiceEligibility {
  serviceId: number
  serviceVersion: number
  eligibleItemTypes: Array<Pick<ItemType, 'id' | 'code' | 'nameVi' | 'nameEn'>>
}

export interface ServiceCoverage {
  serviceId: number
  serviceCode: string
  serviceName: string
  eligibleItemTypeCount: number
  coveredItemTypeCount: number
  missingItemTypeCount: number
}

export interface PriceCoverage {
  priceListId: number
  eligibleCombinationCount: number
  coveredCombinationCount: number
  missingCombinationCount: number
  services: ServiceCoverage[]
}

export interface CatalogSummary {
  activeServiceCount: number
  activeItemTypeCount: number
  eligibleCombinationCount: number
  coveredCombinationCount: number
  configurationIssueCount: number
  effectivePriceListId?: number
}

export interface AuditEntry {
  id: number
  entityType: string
  entityId: number
  action: string
  oldValue: Record<string, unknown>
  newValue: Record<string, unknown>
  reason?: string
  branch?: Branch
  actor: Actor
  createdAt: string
}
