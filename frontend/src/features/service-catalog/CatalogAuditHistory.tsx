import { Clock3 } from 'lucide-react'
import type { AuditEntry } from './types'

const ACTION_LABELS: Record<string, string> = {
  SERVICE_CREATED: 'Created service',
  SERVICE_UPDATED: 'Updated service',
  SERVICE_STATUS_CHANGED: 'Changed service status',
  ITEM_TYPE_CREATED: 'Created item type',
  ITEM_TYPE_UPDATED: 'Updated item type',
  ITEM_TYPE_MOVED: 'Moved item type',
  ITEM_TYPE_STATUS_CHANGED: 'Changed item type status',
  PRICE_LIST_CREATED: 'Created price list',
  PRICE_LIST_UPDATED: 'Updated price list',
  PRICE_LIST_DUPLICATED: 'Duplicated price list',
  PRICE_LIST_SCHEDULED: 'Scheduled price list',
  PRICE_LIST_PUBLISHED: 'Published price list',
  PRICE_LIST_ARCHIVED: 'Archived price list',
  PRICE_RULE_CREATED: 'Added pricing rule',
  PRICE_RULE_UPDATED: 'Updated pricing rule',
  PRICE_RULE_DELETED: 'Deleted draft pricing rule',
  PRICE_RULE_SUPERSEDED: 'Superseded pricing rule',
  PRICING_CONFLICT_OVERRIDDEN: 'Overrode pricing conflict',
}

const FIELD_LABELS: Record<string, string> = {
  code: 'Code',
  name: 'Name',
  nameVi: 'Display name',
  description: 'Description',
  descriptionVi: 'Description',
  branchId: 'Branch ID',
  branchName: 'Branch',
  currency: 'Currency',
  status: 'Status',
  effectiveFrom: 'Effective from',
  effectiveTo: 'Effective to',
  priceRuleId: 'Pricing rule ID',
  priceListId: 'Price list ID',
  sourcePriceListId: 'Source price list ID',
  serviceId: 'Service ID',
  serviceName: 'Service',
  itemTypeId: 'Item type ID',
  itemTypeName: 'Item type',
  sharingMode: 'Processing mode',
  pricingMethod: 'Pricing method',
  unitType: 'Unit',
  priorityLevel: 'Priority level',
  basePrice: 'Base price',
  unitPrice: 'Unit price',
  minimumQuantity: 'Minimum quantity',
  maximumQuantity: 'Maximum quantity',
  minimumCharge: 'Minimum charge',
  includedQuantity: 'Included quantity',
  excessUnitPrice: 'Excess unit price',
  tierCalculationMode: 'Tier calculation',
  rulePriority: 'Rule priority',
  versionNumber: 'Rule version',
  ruleCount: 'Rule count',
  tiers: 'Pricing tiers',
  sharingAllowed: 'Shared processing allowed',
  processingType: 'Processing type',
  defaultUnitType: 'Default unit',
  estimatedMinutes: 'Estimated minutes',
  parentId: 'Parent item ID',
  requiresSeparateWash: 'Requires separate wash',
  defaultColorRisk: 'Default color risk',
  defaultHygieneLevel: 'Default hygiene level',
  sortOrder: 'Sort order',
}

const MONEY_FIELDS = new Set(['basePrice', 'unitPrice', 'minimumCharge', 'excessUnitPrice'])
const DATE_FIELDS = new Set(['effectiveFrom', 'effectiveTo'])
const VALUE_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  ANY: 'Any processing mode',
  ARCHIVED: 'Archived',
  BY_ITEM: 'By item',
  BY_PAIR: 'By pair',
  BY_SET: 'By set',
  BY_WEIGHT: 'By weight',
  DELIVERY: 'Delivery',
  DRAFT: 'Draft',
  DRY_CLEAN: 'Dry cleaning',
  DRY_ONLY: 'Dry only',
  EXPIRED: 'Expired',
  FIXED: 'Fixed price',
  HYBRID: 'Base price plus excess',
  INACTIVE: 'Inactive',
  IRON: 'Ironing',
  ITEM: 'Item',
  KG: 'Kilogram',
  LOAD: 'Load',
  OTHER: 'Other',
  PAIR: 'Pair',
  PER_LOAD: 'Per load',
  PRIVATE_LOAD: 'Private load',
  PROGRESSIVE: 'Progressive tiers',
  SCHEDULED: 'Scheduled',
  SET: 'Set',
  SHARED_PRIORITY: 'Shared priority',
  SHARED_STANDARD: 'Shared standard',
  SHOE_CLEANING: 'Shoe cleaning',
  STAIN_REMOVAL: 'Stain removal',
  VOLUME: 'Volume tiers',
  WASH_DRY: 'Wash and dry',
  WASH_ONLY: 'Wash only',
}

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function formatFieldName(field: string) {
  return FIELD_LABELS[field] ?? field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase())
}

function formatAuditValue(field: string, value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not set'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (MONEY_FIELDS.has(field) && (typeof value === 'number' || typeof value === 'string')) {
    const amount = Number(value)
    return Number.isFinite(amount) ? `${new Intl.NumberFormat('en-US').format(amount)} VND` : String(value)
  }
  if (DATE_FIELDS.has(field) && typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(date)
    }
  }
  if (typeof value === 'string' && VALUE_LABELS[value]) return VALUE_LABELS[value]
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function changes(entry: AuditEntry) {
  const fields = new Set([...Object.keys(entry.oldValue ?? {}), ...Object.keys(entry.newValue ?? {})])
  return [...fields]
    .filter((field) => !valuesEqual(entry.oldValue?.[field], entry.newValue?.[field]))
    .map((field) => ({
      field,
      before: formatAuditValue(field, entry.oldValue?.[field]),
      after: formatAuditValue(field, entry.newValue?.[field]),
    }))
}

export function CatalogAuditHistory({
  entries,
  formatDate,
}: {
  entries: AuditEntry[]
  formatDate: (value?: string) => string
}) {
  return <ol className="catalog-history">
    {entries.map((entry) => {
      const changedFields = changes(entry)
      return <li className="catalog-history__entry" key={entry.id}>
        <header className="catalog-history__heading">
          <span className="catalog-history__icon" aria-hidden="true"><Clock3 size={17} /></span>
          <div>
            <strong>{ACTION_LABELS[entry.action] ?? entry.action.replaceAll('_', ' ')}</strong>
            <span>Changed by {entry.actor.name} · {formatDate(entry.createdAt)}</span>
          </div>
        </header>
        {entry.reason && <p className="catalog-history__reason"><strong>Reason:</strong> {entry.reason}</p>}
        {changedFields.length > 0 && <section className="catalog-history__changes" aria-label="Changes">
          <h3>Changes</h3>
          <div className="catalog-history__change-list">
            {changedFields.map((change) => <article className="catalog-history__change" key={change.field}>
              <strong>{formatFieldName(change.field)}</strong>
              <div><small>Before</small><pre>{change.before}</pre></div>
              <div><small>After</small><pre>{change.after}</pre></div>
            </article>)}
          </div>
        </section>}
      </li>
    })}
  </ol>
}
