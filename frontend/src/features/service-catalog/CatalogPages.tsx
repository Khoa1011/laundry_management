import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity, Archive, ArrowLeft, Boxes, Calculator, CalendarDays, ChevronRight, CircleAlert, Clock3, Copy,
  Edit3, Eye, Layers3, PackagePlus, Plus, Search, Send, Settings2, Shirt, Sparkles, Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { Field } from '../../components/Field'
import { MoneyInput } from '../../components/MoneyInput'
import { AppNavLink } from '../../components/navigation/AppNavLink'
import { ConfirmDialog, OverlayDialog } from '../../components/OverlayDialog'
import { ErrorState, LoadingState, StatePanel } from '../../components/States'
import { Surface } from '../../components/ui/Surface'
import { Button, ButtonLink } from '../../components/ui/Button'
import { ActionMenu as FloatingActionMenu } from '../../components/ui/ActionMenu'
import { StatCard, type StatCardTone } from '../../components/ui/StatCard'
import { useToast } from '../../providers/ToastProvider'
import { CatalogAuditHistory } from './CatalogAuditHistory'
import { catalogApi } from './api'
import type {
  CatalogStatus, ItemType, ItemTypePayload, LaundryService, PriceList, PriceListDetail, PriceRule,
  PriceRulePayload, PricingMethod, ProcessingType, ServicePayload, SharingMode,
  TierCalculationMode, UnitType,
} from './types'

const UNITS: UnitType[] = ['KG', 'ITEM', 'PAIR', 'SET', 'LOAD', 'FIXED']
const PROCESSING_TYPES: ProcessingType[] = ['WASH_DRY', 'WASH_ONLY', 'DRY_ONLY', 'DRY_CLEAN', 'IRON', 'SHOE_CLEANING', 'STAIN_REMOVAL', 'DELIVERY', 'OTHER']
const SHARING_MODES: SharingMode[] = ['ANY', 'SHARED_STANDARD', 'SHARED_PRIORITY', 'PRIVATE_LOAD']

function statusTone(status: string) {
  if (status === 'ACTIVE') return 'success'
  if (status === 'DRAFT') return 'info'
  if (status === 'SCHEDULED') return 'warning'
  if (status === 'ARCHIVED' || status === 'EXPIRED') return 'neutral'
  return 'warning'
}

function statCardTone(status: string): StatCardTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'DRAFT' || status === 'SCHEDULED') return 'warning'
  if (status === 'ARCHIVED' || status === 'EXPIRED') return 'neutral'
  return 'operational'
}

function useCatalogFormat() {
  const { i18n } = useTranslation()
  const locale = i18n.language.startsWith('en') ? 'en-US' : 'vi-VN'
  return {
    date: (value?: string) => value ? new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date(value)) : '—',
    money: (value?: number) => new Intl.NumberFormat(locale, {
      style: 'currency', currency: 'VND', maximumFractionDigits: 0,
    }).format(value ?? 0),
  }
}

function errorMessage(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    if (error.problem.errorCode === 'PRICING_RULE_CONFLICT') return t('catalog:conflict')
    if (error.problem.errorCode === 'PRICING_VERSION_CONFLICT') return t('catalog:stale')
    return error.problem.detail || t('catalog:loadErrorBody')
  }
  return t('catalog:loadErrorBody')
}

function toDateTimeLocal(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return <header className="catalog-page-header">
    <div><h1>{title}</h1><p>{subtitle}</p></div>
    {actions && <div className="catalog-page-header__actions">{actions}</div>}
  </header>
}

function CatalogTabs() {
  const { t } = useTranslation()
  return <Surface variant="subtle" as="nav" className="catalog-module-tabs" aria-label={t('catalog:navigation')}>
    <AppNavLink to="/catalog/services" className="catalog-module-tab" activeClassName="catalog-module-tab--active"
      indicatorId="catalog-module-active"><Shirt size={18} />{t('catalog:services')}</AppNavLink>
    <AppNavLink to="/catalog/item-types" className="catalog-module-tab" activeClassName="catalog-module-tab--active"
      indicatorId="catalog-module-active"><Boxes size={18} />{t('catalog:itemTypes')}</AppNavLink>
    <AppNavLink to="/catalog/price-lists" className="catalog-module-tab" activeClassName="catalog-module-tab--active"
      indicatorId="catalog-module-active"><Layers3 size={18} />{t('catalog:priceLists')}</AppNavLink>
  </Surface>
}

export function ServiceCatalogPage() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const format = useCatalogFormat()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<CatalogStatus | ''>('')
  const [editor, setEditor] = useState<LaundryService | 'new' | null>(null)
  const query = useQuery({
    queryKey: ['catalog-services', search, status],
    queryFn: () => catalogApi.services({ search: search || undefined, status: status || undefined, size: 100 }),
  })
  const statusMutation = useMutation({
    mutationFn: ({ service, next }: { service: LaundryService; next: CatalogStatus }) =>
      catalogApi.serviceStatus(service.id, next, service.version),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['catalog-services'] }); toast.notify(t('catalog:saveSuccess')) },
    onError: (error) => toast.notify({ message: errorMessage(error, t), tone: 'error' }),
  })
  const services = query.data?.items ?? []
  return <div className="catalog-page">
    <PageHeader title={t('catalog:services')} subtitle={t('catalog:servicesSubtitle')} actions={
      hasPermission(PERMISSION_CODES.SERVICE_CREATE)
        ? <Button variant="create" onClick={() => setEditor('new')}><Plus size={18} aria-hidden="true" />{t('catalog:addService')}</Button> : undefined
    } />
    <CatalogTabs />
    <Surface variant="subtle" className="catalog-toolbar">
      <label className="catalog-search"><Search size={18} /><span className="sr-only">{t('search')}</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('catalog:searchServices')} />
      </label>
      <select value={status} onChange={(event) => setStatus(event.target.value as CatalogStatus | '')} aria-label={t('status')}>
        <option value="">{t('catalog:allStatuses')}</option>
        <option value="ACTIVE">{t('catalog:statuses.ACTIVE')}</option>
        <option value="INACTIVE">{t('catalog:statuses.INACTIVE')}</option>
        <option value="ARCHIVED">{t('catalog:statuses.ARCHIVED')}</option>
      </select>
    </Surface>
    {query.isLoading ? <LoadingState rows={5} /> : query.isError
      ? <ErrorState title={t('catalog:loadErrorTitle')} body={t('catalog:loadErrorBody')} onRetry={() => void query.refetch()} />
      : services.length === 0
        ? <Surface variant="base" className="catalog-onboarding">
          <div className="catalog-onboarding__intro"><span className="catalog-onboarding__icon"><Sparkles /></span>
            <div><h2>{t('catalog:setupTitle')}</h2><p>{t('catalog:setupBody')}</p></div></div>
          <ol className="catalog-setup-steps">
            <li><strong>1. {t('catalog:services')}</strong><span>{t('catalog:setupService')}</span><small>Giặt sấy thường</small></li>
            <li><strong>2. {t('catalog:itemTypes')}</strong><span>{t('catalog:setupItem')}</span><small>Quần áo → Áo sơ mi</small></li>
            <li><strong>3. {t('catalog:priceLists')}</strong><span>{t('catalog:setupPrice')}</span><small>18.000đ / kg</small></li>
          </ol>
          {hasPermission(PERMISSION_CODES.SERVICE_CREATE) && <Button variant="create" onClick={() => setEditor('new')}>
            <Plus size={18} aria-hidden="true" />{t('catalog:startSetup')}</Button>}
        </Surface>
        : <>
          <div className="catalog-mobile-list">
            {services.map((service) => <article className="catalog-record-card" key={service.id}>
              <div className="catalog-record-card__heading"><div><strong>{service.nameVi}</strong><small>{service.code}</small></div>
                <div className="catalog-record-card__commands"><span className={`status-badge status-badge--${statusTone(service.status)}`}>{t(`catalog:statuses.${service.status}`)}</span>
                  <ServiceActionMenu service={service} canUpdate={hasPermission(PERMISSION_CODES.SERVICE_UPDATE)} canChangeStatus={hasPermission(PERMISSION_CODES.SERVICE_ARCHIVE)} pending={statusMutation.isPending}
                    onEdit={() => setEditor(service)} onStatus={() => statusMutation.mutate({ service, next: service.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })} t={t} /></div></div>
              <dl><div><dt>{t('catalog:processingType')}</dt><dd>{t(`catalog:processing.${service.processingType}`)}</dd></div>
                <div><dt>{t('catalog:defaultUnit')}</dt><dd>{t(`catalog:units.${service.defaultUnitType}`)}</dd></div>
                <div><dt>{t('catalog:sharingAllowed')}</dt><dd>{service.sharingAllowed ? t('yes') : t('no')}</dd></div></dl>
              <div className="catalog-record-card__metrics"><span>{service.eligibleItemTypeCount} {t('catalog:itemTypes').toLowerCase()}</span><span>{service.relatedPriceRuleCount} {t('catalog:priceLists').toLowerCase()}</span></div>
            </article>)}
          </div>
          <div className="catalog-table-wrap"><table className="catalog-table"><thead><tr>
            <th>{t('catalog:service')}</th><th>{t('catalog:processingType')}</th><th>{t('catalog:defaultUnit')}</th>
            <th>{t('catalog:sharingAllowed')}</th><th>{t('catalog:eligibleItems')}</th><th>{t('catalog:priceLists')}</th><th>{t('status')}</th><th>{t('catalog:updated')}</th><th>{t('actions')}</th>
          </tr></thead><tbody>{services.map((service) => <tr key={service.id}>
            <td><strong>{service.nameVi}</strong><small>{service.code}</small></td>
            <td>{t(`catalog:processing.${service.processingType}`)}</td><td>{t(`catalog:units.${service.defaultUnitType}`)}</td>
            <td>{service.sharingAllowed ? t('yes') : t('no')}</td>
            <td>{service.eligibleItemTypeCount}</td><td>{service.relatedPriceRuleCount}</td>
            <td><span className={`status-badge status-badge--${statusTone(service.status)}`}>{t(`catalog:statuses.${service.status}`)}</span></td>
            <td>{format.date(service.updatedAt)}</td><td><ServiceActionMenu service={service}
              canUpdate={hasPermission(PERMISSION_CODES.SERVICE_UPDATE)} canChangeStatus={hasPermission(PERMISSION_CODES.SERVICE_ARCHIVE)} pending={statusMutation.isPending}
              onEdit={() => setEditor(service)} onStatus={() => statusMutation.mutate({ service, next: service.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })} t={t} /></td>
          </tr>)}</tbody></table></div>
        </>}
    <ServiceEditor key={editor === 'new' ? 'new' : editor?.id ?? 'closed'} open={editor !== null}
      service={editor === 'new' ? undefined : editor ?? undefined} onClose={() => setEditor(null)}
      onSaved={() => { setEditor(null); void queryClient.invalidateQueries({ queryKey: ['catalog-services'] }) }} />
  </div>
}

function ServiceEditor({ open, service, onClose, onSaved }: { open: boolean; service?: LaundryService; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const toast = useToast()
  const [submitted, setSubmitted] = useState(false)
  const canManageEligibility = hasPermission(PERMISSION_CODES.SERVICE_UPDATE)
    && hasPermission(PERMISSION_CODES.ITEM_TYPE_READ)
  const itemTypes = useQuery({ queryKey: ['catalog-item-types'], queryFn: catalogApi.itemTypes, enabled: open && canManageEligibility })
  const existingEligibility = useQuery({
    queryKey: ['service-eligibility', service?.id], queryFn: () => catalogApi.serviceEligibility(service!.id),
    enabled: open && Boolean(service) && canManageEligibility,
  })
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([])
  const leafItems = useMemo(() => flattenItems(itemTypes.data ?? []).map(({ item }) => item)
    .filter((item) => item.children.length === 0 && item.status === 'ACTIVE'), [itemTypes.data])
  useEffect(() => {
    if (existingEligibility.data) setSelectedItemIds(existingEligibility.data.eligibleItemTypes.map((item) => item.id))
  }, [existingEligibility.data])
  const [form, setForm] = useState<ServicePayload>(() => service ? {
    nameVi: service.nameVi, nameEn: service.nameEn, descriptionVi: service.descriptionVi,
    descriptionEn: service.descriptionEn, processingType: service.processingType,
    defaultUnitType: service.defaultUnitType, sharingAllowed: service.sharingAllowed,
    estimatedMinutes: service.estimatedMinutes, minimumQuantity: service.minimumQuantity, version: service.version,
  } : { nameVi: '', processingType: 'WASH_DRY', defaultUnitType: 'KG', sharingAllowed: true })
  const mutation = useMutation({
    mutationFn: async () => {
      const saved = service ? await catalogApi.updateService(service.id, form) : await catalogApi.createService(form)
      if (canManageEligibility) {
        await catalogApi.updateServiceEligibility(saved.id, saved.version, selectedItemIds)
      }
      return saved
    },
    onSuccess: () => { toast.notify(t('catalog:saveSuccess')); onSaved() },
    onError: (error) => toast.notify({ message: errorMessage(error, t), tone: 'error' }),
  })
  const set = <K extends keyof ServicePayload>(key: K, value: ServicePayload[K]) => setForm((current) => ({ ...current, [key]: value }))
  const submitForm = () => {
    setSubmitted(true)
    if (form.nameVi.trim()) mutation.mutate()
  }
  const submit = (event: FormEvent) => { event.preventDefault(); submitForm() }
  return <OverlayDialog open={open} onClose={onClose} variant="drawer" title={service ? t('catalog:editService') : t('catalog:addService')}
    description={t('catalog:serviceDrawerDescription')}
    footer={<><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button variant={service ? 'primary' : 'create'} loading={mutation.isPending} onClick={submitForm}>{t('save')}</Button></>}>
    <form className="catalog-drawer-form" onSubmit={submit}>
      <section className="catalog-drawer-section"><DrawerSectionHeading icon={<Shirt size={19} />} title={t('catalog:serviceBasics')} body={t('catalog:serviceBasicsHint')} />
        <div className="catalog-form-grid"><Field label={t('catalog:nameVi')} required error={submitted && !form.nameVi.trim() ? t('catalog:requiredName') : undefined}>
          <input value={form.nameVi} required autoFocus onChange={(e) => set('nameVi', e.target.value)} />
        </Field>
        <Field label={t('catalog:description')}><textarea rows={3} value={form.descriptionVi ?? ''} onChange={(e) => set('descriptionVi', e.target.value)} /></Field></div>
      </section>
      <section className="catalog-drawer-section"><DrawerSectionHeading icon={<Settings2 size={19} />} title={t('catalog:serviceOperations')} body={t('catalog:serviceOperationsHint')} />
        <div className="catalog-form-grid catalog-form-grid--paired"><Field label={t('catalog:processingType')} required><select value={form.processingType} onChange={(e) => set('processingType', e.target.value as ProcessingType)}>
          {PROCESSING_TYPES.map((value) => <option value={value} key={value}>{t(`catalog:processing.${value}`)}</option>)}</select></Field>
        <Field label={t('catalog:defaultUnit')} required><select value={form.defaultUnitType} onChange={(e) => set('defaultUnitType', e.target.value as UnitType)}>
          {UNITS.map((value) => <option value={value} key={value}>{t(`catalog:units.${value}`)}</option>)}</select></Field>
        <Field label={t('catalog:estimatedMinutes')}><input inputMode="numeric" value={form.estimatedMinutes ?? ''} onChange={(e) => set('estimatedMinutes', e.target.value ? Number(e.target.value) : undefined)} /></Field>
        <Field label={t('catalog:minimumQuantity')}><input inputMode="decimal" value={form.minimumQuantity ?? ''} onChange={(e) => set('minimumQuantity', e.target.value ? Number(e.target.value) : undefined)} /></Field></div>
        <label className="catalog-check"><input type="checkbox" checked={form.sharingAllowed} onChange={(e) => set('sharingAllowed', e.target.checked)} /><span><strong>{t('catalog:sharingAllowed')}</strong><small>{t('catalog:sharingAllowedHint')}</small></span></label>
      </section>
      {canManageEligibility && <section className="catalog-drawer-section"><DrawerSectionHeading icon={<Boxes size={19} />} title={t('catalog:eligibleItems')} body={t('catalog:eligibleItemsHint')} />
        {leafItems.length === 0 ? <p className="catalog-inline-warning">{t('catalog:noItemsBody')}</p> : <div className="catalog-choice-list">
          {leafItems.map((item) => <label key={item.id} className="catalog-choice-row"><input type="checkbox"
            checked={selectedItemIds.includes(item.id)} onChange={(event) => setSelectedItemIds((current) =>
              event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
            <span><strong>{item.nameVi}</strong><small>{item.code} · {item.effectiveUnitType ? t(`catalog:units.${item.effectiveUnitType}`) : '—'}</small></span></label>)}
        </div>}
      </section>}
      <button type="submit" hidden />
    </form>
  </OverlayDialog>
}

function flattenItems(items: ItemType[], depth = 0): Array<{ item: ItemType; depth: number }> {
  return items.flatMap((item) => [{ item, depth }, ...flattenItems(item.children, depth + 1)])
}

export function ItemTypeCatalogPage() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [selected, setSelected] = useState<ItemType | undefined>()
  const [editor, setEditor] = useState<{ item?: ItemType; parentId?: number } | null>(null)
  const [statusTarget, setStatusTarget] = useState<{ item: ItemType; next: CatalogStatus } | null>(null)
  const query = useQuery({ queryKey: ['catalog-item-types'], queryFn: catalogApi.itemTypes })
  const flattened = useMemo(() => flattenItems(query.data ?? []), [query.data])
  const statusMutation = useMutation({
    mutationFn: ({ item, next }: { item: ItemType; next: CatalogStatus }) =>
      catalogApi.itemTypeStatus(item.id, next, item.version),
    onSuccess: () => {
      setStatusTarget(null)
      setSelected(undefined)
      void queryClient.invalidateQueries({ queryKey: ['catalog-item-types'] })
      toast.notify(t('catalog:saveSuccess'))
    },
    onError: (error) => toast.notify({ message: errorMessage(error, t), tone: 'error' }),
  })
  return <div className="catalog-page">
    <PageHeader title={t('catalog:itemTypes')} subtitle={t('catalog:itemTypesSubtitle')} actions={
      hasPermission(PERMISSION_CODES.ITEM_TYPE_CREATE)
        ? <Button variant="create" onClick={() => setEditor({})}><Plus size={18} aria-hidden="true" />{t('catalog:addItemType')}</Button> : undefined
    } />
    <CatalogTabs />
    {query.isLoading ? <LoadingState rows={5} /> : query.isError
      ? <ErrorState title={t('catalog:loadErrorTitle')} body={t('catalog:loadErrorBody')} onRetry={() => void query.refetch()} />
      : flattened.length === 0 ? <StatePanel icon={<Boxes />} title={t('catalog:noItemsTitle')} body={t('catalog:noItemsBody')} />
        : <div className="item-type-layout">
          <section className="item-tree" aria-label={t('catalog:itemTypes')}>{flattened.map(({ item, depth }) =>
            <button key={item.id} type="button" className={selected?.id === item.id ? 'is-selected' : ''} style={{ '--tree-depth': depth } as React.CSSProperties} onClick={() => setSelected(item)}>
              <span><Boxes size={17} /><strong>{item.nameVi}</strong></span><span>{item.effectiveUnitType ? t(`catalog:units.${item.effectiveUnitType}`) : '—'}<ChevronRight size={16} /></span>
            </button>)}</section>
          <section className="item-detail">
            {selected ? <>
              <div className="item-detail__title"><div><h2>{selected.nameVi}</h2><p>{selected.code}</p></div>
                <span className={`status-badge status-badge--${statusTone(selected.status)}`}>{t(`catalog:statuses.${selected.status}`)}</span></div>
              <dl className="catalog-detail-list"><div><dt>{t('catalog:defaultUnit')}</dt><dd>{selected.effectiveUnitType ? t(`catalog:units.${selected.effectiveUnitType}`) : '—'} {selected.inheritedUnit && <small>{t('catalog:inherited')}</small>}</dd></div>
                <div><dt>{t('catalog:separateWash')}</dt><dd>{selected.requiresSeparateWash ? t('yes') : t('no')}</dd></div>
                <div><dt>{t('catalog:services')}</dt><dd>{selected.applicableServiceCount}</dd></div>
                <div><dt>{t('catalog:ruleCount', { count: selected.relatedPriceRuleCount })}</dt><dd>{selected.relatedPriceRuleCount}</dd></div></dl>
              <div className="item-detail__actions">
                {hasPermission(PERMISSION_CODES.ITEM_TYPE_UPDATE) && selected.status !== 'ARCHIVED' && <Button variant="secondary" onClick={() => setEditor({ item: selected })}><Edit3 size={17} />{t('edit')}</Button>}
                {hasPermission(PERMISSION_CODES.ITEM_TYPE_CREATE) && selected.status !== 'ARCHIVED' && <Button variant="create" onClick={() => setEditor({ parentId: selected.id })}><PackagePlus size={17} aria-hidden="true" />{t('catalog:addChild')}</Button>}
                {hasPermission(PERMISSION_CODES.ITEM_TYPE_ARCHIVE) && selected.status !== 'ARCHIVED' && <>
                  <Button variant="outline" onClick={() => setStatusTarget({
                    item: selected, next: selected.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                  })}>{selected.status === 'ACTIVE' ? t('catalog:deactivate') : t('catalog:activate')}</Button>
                  <Button variant="danger" onClick={() => setStatusTarget({ item: selected, next: 'ARCHIVED' })}>
                    <Archive size={17} />{t('catalog:archive')}
                  </Button>
                </>}
              </div>
            </> : <StatePanel compact title={t('catalog:itemTypes')} body={t('catalog:itemTypesSubtitle')} />}
          </section>
        </div>}
    <ItemTypeEditor key={editor?.item?.id ?? editor?.parentId ?? 'closed'} open={editor !== null}
      item={editor?.item} parentId={editor?.parentId} items={flattened.map((entry) => entry.item)}
      onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setSelected(undefined); void queryClient.invalidateQueries({ queryKey: ['catalog-item-types'] }) }} />
    <ConfirmDialog open={statusTarget !== null} onClose={() => setStatusTarget(null)}
      onConfirm={() => statusTarget && statusMutation.mutate(statusTarget)} pending={statusMutation.isPending}
      tone={statusTarget?.next === 'ARCHIVED' ? 'danger' : 'primary'}
      title={statusTarget?.next === 'ARCHIVED' ? t('catalog:archiveItemTitle') : t('catalog:changeStatusTitle')}
      body={statusTarget?.next === 'ARCHIVED' ? t('catalog:archiveItemBody') : t('catalog:changeStatusBody')}
      confirmLabel={statusTarget?.next === 'ARCHIVED' ? t('catalog:archive') : t('confirm')} />
  </div>
}

function ItemTypeEditor({ open, item, parentId, items, onClose, onSaved }: {
  open: boolean; item?: ItemType; parentId?: number; items: ItemType[]; onClose: () => void; onSaved: () => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState<ItemTypePayload>(() => item ? {
    parentId: item.parentId, nameVi: item.nameVi, nameEn: item.nameEn, descriptionVi: item.descriptionVi,
    descriptionEn: item.descriptionEn, defaultUnitType: item.defaultUnitType,
    requiresSeparateWash: item.requiresSeparateWash, defaultColorRisk: item.defaultColorRisk,
    defaultHygieneLevel: item.defaultHygieneLevel, sortOrder: item.sortOrder, version: item.version,
  } : { parentId, nameVi: '', requiresSeparateWash: false, sortOrder: 0 })
  const mutation = useMutation({
    mutationFn: () => item ? catalogApi.updateItemType(item.id, form) : catalogApi.createItemType(form),
    onSuccess: onSaved,
    onError: (error) => toast.notify({ message: errorMessage(error, t), tone: 'error' }),
  })
  const set = <K extends keyof ItemTypePayload>(key: K, value: ItemTypePayload[K]) => setForm((current) => ({ ...current, [key]: value }))
  const submit = () => {
    setSubmitted(true)
    if (form.nameVi.trim()) mutation.mutate()
  }
  return <OverlayDialog open={open} onClose={onClose} variant="drawer" title={item ? t('catalog:editItemType') : t('catalog:addItemType')}
    description={t('catalog:itemDrawerDescription')}
    footer={<><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button variant={item ? 'primary' : 'create'} loading={mutation.isPending} onClick={submit}>{t('save')}</Button></>}>
    <div className="catalog-drawer-form">
      <section className="catalog-drawer-section"><DrawerSectionHeading icon={<Boxes size={19} />} title={t('catalog:itemIdentity')} body={t('catalog:itemIdentityHint')} />
        <div className="catalog-form-grid"><Field label={t('catalog:nameVi')} required error={submitted && !form.nameVi.trim() ? t('catalog:requiredName') : undefined}>
          <input required autoFocus value={form.nameVi} onChange={(e) => set('nameVi', e.target.value)} />
        </Field>
        <Field label={t('catalog:parent')}><select value={form.parentId ?? ''} onChange={(e) => set('parentId', e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">{t('catalog:rootItem')}</option>{items.filter((candidate) => candidate.id !== item?.id && candidate.status !== 'ARCHIVED').map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.nameVi}</option>)}</select></Field>
        <Field label={t('catalog:sortOrder')}><input inputMode="numeric" value={form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} /></Field>
        <Field label={t('catalog:description')}><textarea rows={3} value={form.descriptionVi ?? ''} onChange={(e) => set('descriptionVi', e.target.value)} /></Field></div>
      </section>
      <section className="catalog-drawer-section"><DrawerSectionHeading icon={<Settings2 size={19} />} title={t('catalog:itemDefaults')} body={t('catalog:itemDefaultsHint')} />
        <Field label={t('catalog:defaultUnit')} hint={t('catalog:inherited')}><select value={form.defaultUnitType ?? ''} onChange={(e) => set('defaultUnitType', e.target.value ? e.target.value as UnitType : undefined)}>
          <option value="">{t('catalog:inherited')}</option>{UNITS.map((unit) => <option key={unit} value={unit}>{t(`catalog:units.${unit}`)}</option>)}</select></Field>
        <label className="catalog-check"><input type="checkbox" checked={form.requiresSeparateWash} onChange={(e) => set('requiresSeparateWash', e.target.checked)} /><span><strong>{t('catalog:separateWash')}</strong></span></label>
      </section>
    </div>
  </OverlayDialog>
}

export function PriceListPage() {
  const { t } = useTranslation()
  const { branchId, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [editorTarget, setEditorTarget] = useState<PriceList | 'new' | null>(null)
  const [duplicateTarget, setDuplicateTarget] = useState<PriceList | null>(null)
  const [mainRuleEditorOpen, setMainRuleEditorOpen] = useState(false)
  const queryClient = useQueryClient()
  const format = useCatalogFormat()
  const query = useQuery({
    queryKey: ['price-lists', branchId, search],
    queryFn: () => catalogApi.priceLists({ branchId: branchId ?? undefined, search: search || undefined, size: 100 }),
    enabled: branchId !== null,
  })
  const summary = useQuery({ queryKey: ['catalog-summary', branchId], queryFn: () => catalogApi.summary(branchId ?? undefined), enabled: branchId !== null })
  const lists = query.data?.items ?? []
  const primaryList = lists.find((list) => list.status === 'ACTIVE') ?? lists.find((list) => list.status === 'DRAFT') ?? lists[0]
  const primaryDetail = useQuery({
    queryKey: ['price-list', primaryList?.id],
    queryFn: () => catalogApi.priceList(primaryList!.id),
    enabled: Boolean(primaryList) && hasPermission(PERMISSION_CODES.PRICE_RULE_READ),
  })
  const primaryRuleGroups = (primaryDetail.data?.rules ?? []).reduce<Record<string, PriceRule[]>>((groups, rule) => {
    groups[rule.service.nameVi] = [...(groups[rule.service.nameVi] ?? []), rule]
    return groups
  }, {})
  return <div className="catalog-page">
    <PageHeader title={t('catalog:priceLists')} subtitle={t('catalog:priceListsSubtitle')} actions={
      hasPermission(PERMISSION_CODES.PRICE_LIST_CREATE)
        ? <Button variant="create" onClick={() => setEditorTarget('new')}><Plus size={18} aria-hidden="true" />{t('catalog:addPriceList')}</Button> : undefined
    } />
    <CatalogTabs />
    {summary.data && <section className="stat-card-grid catalog-summary-grid" aria-label={t('catalog:setupTitle')}>
      <StatCard tone="primary" icon={<Shirt />} label={t('catalog:services')} value={summary.data.activeServiceCount} supporting={t('catalog:statuses.ACTIVE')} />
      <StatCard tone="operational" icon={<Boxes />} label={t('catalog:itemTypes')} value={summary.data.activeItemTypeCount} />
      <StatCard tone="success" icon={<Calculator />} label={t('catalog:configuredPrices', { count: summary.data.coveredCombinationCount })} value={summary.data.coveredCombinationCount} />
      <StatCard tone={summary.data.configurationIssueCount ? 'warning' : 'neutral'} icon={<CircleAlert />} label={t('catalog:missingPrices', { count: summary.data.configurationIssueCount })} value={summary.data.configurationIssueCount} />
    </section>}
    {primaryList && <Surface variant="base" className="current-price-list"><div><span>{t('catalog:selectedPriceList')}</span><h2>{primaryList.name}</h2><p>{primaryList.branch.name} · {format.date(primaryList.effectiveFrom)} → {format.date(primaryList.effectiveTo)}</p></div>
      <div><span className={`status-badge status-badge--${statusTone(primaryList.status)}`}>{t(`catalog:statuses.${primaryList.status}`)}</span>
        {primaryList.status === 'DRAFT' && hasPermission(PERMISSION_CODES.PRICE_RULE_READ) && hasPermission(PERMISSION_CODES.PRICE_RULE_CREATE)
          && hasPermission(PERMISSION_CODES.SERVICE_READ) && hasPermission(PERMISSION_CODES.ITEM_TYPE_READ)
          ? <Button variant="create" onClick={() => setMainRuleEditorOpen(true)}><Plus size={17} />{t('catalog:addRule')}</Button>
          : <ButtonLink to={`/catalog/price-lists/${primaryList.id}`} variant="primary">{t('catalog:view')}<ChevronRight size={17} /></ButtonLink>}</div></Surface>}
    {primaryList && hasPermission(PERMISSION_CODES.PRICE_RULE_READ) && <section className="catalog-selling-prices"><div className="catalog-section-heading"><div><h2>{t('catalog:currentSellingPrices')}</h2><p>{primaryList.name}</p></div><ButtonLink to={`/catalog/price-lists/${primaryList.id}`} variant="secondary">{t('catalog:managePriceLists')}</ButtonLink></div>
      {primaryDetail.isLoading ? <LoadingState rows={3} /> : Object.keys(primaryRuleGroups).length === 0
        ? <StatePanel compact icon={<Layers3 />} title={t('catalog:noRulesTitle')} body={t('catalog:noRulesBody')} />
        : <div className="rule-service-groups">{Object.entries(primaryRuleGroups).map(([serviceName, serviceRules]) => <section className="rule-service-group" key={serviceName}><header><div><h3>{serviceName}</h3><p>{t('catalog:ruleCount', { count: serviceRules.length })}</p></div></header><div className="rule-list">{serviceRules.map((rule) => <article className="rule-card" key={rule.id}><div className="rule-card__title"><div><strong>{rule.itemType?.nameVi ?? t('catalog:anyItemType')}</strong></div><span className={`status-badge status-badge--${statusTone(rule.status)}`}>{t(`catalog:methods.${rule.pricingMethod}`)}</span></div><PriceRuleSummary rule={rule} formatMoney={format.money} t={t} /></article>)}</div></section>)}</div>}
    </section>}
    <div className="catalog-section-heading"><div><h2>{t('catalog:managePriceLists')}</h2><p>{t('catalog:priceListsSubtitle')}</p></div></div>
    <Surface variant="subtle" className="catalog-toolbar"><label className="catalog-search"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('catalog:searchPriceLists')} /></label></Surface>
    {query.isLoading ? <LoadingState rows={4} /> : query.isError
      ? <ErrorState title={t('catalog:loadErrorTitle')} body={t('catalog:loadErrorBody')} onRetry={() => void query.refetch()} />
      : lists.length === 0 ? <StatePanel icon={<Layers3 />} title={t('catalog:noPricesTitle')} body={t('catalog:noPricesBody')} />
        : <>
          <div className="catalog-mobile-list price-list-grid">{lists.map((list) => <article className="price-list-card" key={list.id}>
            <div className="price-list-card__top"><div><small>{list.code}</small><h2>{list.name}</h2></div><div className="catalog-record-card__commands"><span className={`status-badge status-badge--${statusTone(list.status)}`}>{t(`catalog:statuses.${list.status}`)}</span>
              <PriceListActionMenu priceList={list} canEdit={hasPermission(PERMISSION_CODES.PRICE_LIST_UPDATE_DRAFT)} canDuplicate={hasPermission(PERMISSION_CODES.PRICE_LIST_DUPLICATE)}
                onEdit={() => setEditorTarget(list)} onDuplicate={() => setDuplicateTarget(list)} t={t} /></div></div>
            <dl><div><dt>{t('catalog:branch')}</dt><dd>{list.branch.name}</dd></div><div><dt>{t('catalog:effectiveFrom')}</dt><dd>{format.date(list.effectiveFrom)}</dd></div><div><dt>{t('catalog:ruleCount', { count: list.ruleCount })}</dt><dd>{list.ruleCount}</dd></div></dl>
          </article>)}</div>
          <div className="catalog-table-wrap"><table className="catalog-table"><thead><tr>
            <th>{t('catalog:priceListName')}</th><th>{t('catalog:branch')}</th><th>{t('status')}</th>
            <th>{t('catalog:effectiveFrom')}</th><th>{t('catalog:effectiveTo')}</th>
            <th>{t('catalog:ruleCount', { count: 0 })}</th><th>{t('catalog:updated')}</th><th>{t('actions')}</th>
          </tr></thead><tbody>{lists.map((list) => <tr key={list.id}>
            <td><strong>{list.name}</strong><small>{list.code}</small></td><td>{list.branch.name}</td>
            <td><span className={`status-badge status-badge--${statusTone(list.status)}`}>{t(`catalog:statuses.${list.status}`)}</span></td>
            <td>{format.date(list.effectiveFrom)}</td><td>{format.date(list.effectiveTo)}</td>
            <td>{list.ruleCount}</td><td>{format.date(list.updatedAt)}</td>
            <td><PriceListActionMenu priceList={list} canEdit={hasPermission(PERMISSION_CODES.PRICE_LIST_UPDATE_DRAFT)} canDuplicate={hasPermission(PERMISSION_CODES.PRICE_LIST_DUPLICATE)}
              onEdit={() => setEditorTarget(list)} onDuplicate={() => setDuplicateTarget(list)} t={t} /></td>
          </tr>)}</tbody></table></div>
        </>}
    {branchId && <PriceListEditor key={editorTarget === 'new' ? 'new' : editorTarget?.id ?? 'closed'} open={editorTarget !== null} branchId={branchId}
      priceList={editorTarget === 'new' ? undefined : editorTarget ?? undefined} onClose={() => setEditorTarget(null)} onSaved={(id) => {
      setEditorTarget(null); void queryClient.invalidateQueries({ queryKey: ['price-lists'] }); navigate(`/catalog/price-lists/${id}`)
    }} />}
    {duplicateTarget && <DuplicatePriceListEditor key={duplicateTarget.id} open priceList={duplicateTarget}
      onClose={() => setDuplicateTarget(null)} onSaved={(id) => { setDuplicateTarget(null); void queryClient.invalidateQueries({ queryKey: ['price-lists'] }); navigate(`/catalog/price-lists/${id}`) }} />}
    {primaryDetail.data && <RuleEditor key={mainRuleEditorOpen ? `main-${primaryDetail.data.priceList.id}` : 'main-closed'}
      open={mainRuleEditorOpen} priceList={primaryDetail.data.priceList} onClose={() => setMainRuleEditorOpen(false)}
      onSaved={() => { setMainRuleEditorOpen(false); void queryClient.invalidateQueries({ queryKey: ['price-list', primaryDetail.data!.priceList.id] }) }} />}
  </div>
}

function DrawerSectionHeading({ icon, title, body }: { icon: React.ReactNode; title: string; body?: string }) {
  return <div className="catalog-drawer-section__heading"><span className="catalog-drawer-section__icon">{icon}</span><div><h3>{title}</h3>{body && <p>{body}</p>}</div></div>
}

function ServiceActionMenu({ service, canUpdate, canChangeStatus, pending, onEdit, onStatus, t }: {
  service: LaundryService; canUpdate: boolean; canChangeStatus: boolean; pending: boolean
  onEdit: () => void; onStatus: () => void; t: ReturnType<typeof useTranslation>['t']
}) {
  if ((!canUpdate && !canChangeStatus) || service.status === 'ARCHIVED') return null
  return <FloatingActionMenu label={t('openMenu')}>
    {canUpdate && <button type="button" role="menuitem" onClick={onEdit}><Edit3 size={25} aria-hidden="true" /><span className="action-menu__label">{t('edit')}</span></button>}
    {canChangeStatus && <button type="button" role="menuitem" disabled={pending} onClick={onStatus}><Activity size={25} aria-hidden="true" /><span className="action-menu__label">{service.status === 'ACTIVE' ? t('catalog:deactivate') : t('catalog:activate')}</span></button>}
  </FloatingActionMenu>
}

function PriceListActionMenu({ priceList, canEdit, canDuplicate, onEdit, onDuplicate, t }: {
  priceList: PriceList; canEdit: boolean; canDuplicate: boolean; onEdit: () => void; onDuplicate: () => void
  t: ReturnType<typeof useTranslation>['t']
}) {
  return <FloatingActionMenu label={t('openMenu')}>
    <Link role="menuitem" to={`/catalog/price-lists/${priceList.id}`}><Eye size={26} aria-hidden="true" /><span className="action-menu__label">{t('catalog:view')}</span></Link>
    {canEdit && priceList.status === 'DRAFT' && <button type="button" role="menuitem" onClick={onEdit}><Edit3 size={25} aria-hidden="true" /><span className="action-menu__label">{t('edit')}</span></button>}
    {canDuplicate && <button type="button" role="menuitem" onClick={onDuplicate}><Copy size={25} aria-hidden="true" /><span className="action-menu__label">{t('catalog:duplicate')}</span></button>}
  </FloatingActionMenu>
}

function PriceListEditor({ open, branchId, priceList, onClose, onSaved }: {
  open: boolean; branchId: number; priceList?: PriceList; onClose: () => void; onSaved: (id: number) => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [form, setForm] = useState(() => ({
    name: priceList?.name ?? '',
    description: priceList?.description ?? '',
    effectiveFrom: toDateTimeLocal(priceList?.effectiveFrom),
    effectiveTo: toDateTimeLocal(priceList?.effectiveTo),
  }))
  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
      name: form.name, description: form.description || undefined, branchId, currency: 'VND',
      effectiveFrom: new Date(form.effectiveFrom).toISOString(),
      effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : undefined,
      }
      return priceList
        ? catalogApi.updatePriceList(priceList.id, { ...payload, version: priceList.version })
        : catalogApi.createPriceList(payload)
    },
    onSuccess: (created) => onSaved(created.id),
    onError: (error) => toast.notify({ message: errorMessage(error, t), tone: 'error' }),
  })
  return <OverlayDialog open={open} onClose={onClose} variant="drawer"
    title={priceList ? t('catalog:editPriceList') : t('catalog:addPriceList')}
    description={t('catalog:priceListDrawerDescription')}
    footer={<><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button variant={priceList ? 'primary' : 'create'} disabled={!form.name || !form.effectiveFrom} loading={mutation.isPending} onClick={() => mutation.mutate()}>{t('save')}</Button></>}>
    <div className="catalog-drawer-form"><section className="catalog-drawer-section"><DrawerSectionHeading icon={<Layers3 size={19} />} title={t('catalog:priceListIdentity')} body={t('catalog:priceListIdentityHint')} />
      <div className="catalog-form-grid"><Field label={t('catalog:priceListName')} required><input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label={t('catalog:description')}><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div></section>
      <section className="catalog-drawer-section"><DrawerSectionHeading icon={<CalendarDays size={19} />} title={t('catalog:priceListPeriod')} body={t('catalog:priceListPeriodHint')} />
        <div className="catalog-form-grid catalog-form-grid--paired"><Field label={t('catalog:effectiveFrom')} required><input type="datetime-local" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} /></Field>
        <Field label={t('catalog:effectiveTo')}><input type="datetime-local" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} /></Field></div></section>
    </div>
  </OverlayDialog>
}

function DuplicatePriceListEditor({ open, priceList, onClose, onSaved }: {
  open: boolean; priceList: PriceList; onClose: () => void; onSaved: (id: number) => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [form, setForm] = useState({
    name: `${priceList.name} — ${t('catalog:draftCopy')}`,
    effectiveFrom: '',
    effectiveTo: '',
  })
  const mutation = useMutation({
    mutationFn: () => catalogApi.duplicatePriceList(priceList.id, {
      name: form.name,
      effectiveFrom: new Date(form.effectiveFrom).toISOString(),
      effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : undefined,
    }),
    onSuccess: (created) => onSaved(created.priceList.id),
    onError: (error) => toast.notify({ message: errorMessage(error, t), tone: 'error' }),
  })
  return <OverlayDialog open={open} onClose={onClose} variant="drawer" title={t('catalog:duplicateTitle')} description={t('catalog:duplicateDrawerDescription')}
    footer={<><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
      <Button disabled={!form.name || !form.effectiveFrom} loading={mutation.isPending}
        onClick={() => mutation.mutate()}>{t('catalog:duplicate')}</Button></>}>
    <div className="catalog-drawer-form">
      <Surface variant="selected" className="catalog-source-summary"><Layers3 size={20} /><div><strong>{priceList.name}</strong><span>{priceList.code} · {priceList.branch.name}</span></div></Surface>
      <section className="catalog-drawer-section"><DrawerSectionHeading icon={<Copy size={19} />} title={t('catalog:priceListIdentity')} body={t('catalog:duplicateDrawerDescription')} />
      <div className="catalog-form-grid"><Field label={t('catalog:duplicateName')} required>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      </Field></div></section>
      <section className="catalog-drawer-section"><DrawerSectionHeading icon={<CalendarDays size={19} />} title={t('catalog:priceListPeriod')} body={t('catalog:priceListPeriodHint')} />
      <div className="catalog-form-grid catalog-form-grid--paired"><Field label={t('catalog:effectiveFrom')} required>
        <input type="datetime-local" value={form.effectiveFrom}
          onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} />
      </Field>
      <Field label={t('catalog:effectiveTo')}>
        <input type="datetime-local" value={form.effectiveTo}
          onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })} />
      </Field></div></section>
    </div>
  </OverlayDialog>
}

function PriceRuleSummary({ rule, formatMoney, t }: {
  rule: PriceRule
  formatMoney: (value?: number) => string
  t: (key: string) => string
}) {
  if (rule.pricingMethod === 'HYBRID') return <div className="rule-business-summary">
    <strong>{formatMoney(rule.basePrice)} {rule.includedQuantity ? `cho ${rule.includedQuantity} ${t(`catalog:units.${rule.unitType}`)} đầu` : ''}</strong>
    <span>+{formatMoney(rule.excessUnitPrice)} / {t(`catalog:units.${rule.unitType}`)} vượt</span>
  </div>
  if (rule.pricingMethod === 'QUANTITY_PACKAGE') return <div className="rule-package-summary">
    {rule.packagePrices.map((item) => <span key={item.quantity}>{item.quantity} {t(`catalog:units.${rule.unitType}`)} <strong>{formatMoney(item.totalPrice)}</strong></span>)}
  </div>
  if (rule.tierCalculationMode) return <div className="rule-package-summary">
    {rule.tiers.map((tier) => <span key={tier.fromQuantity}>{tier.fromQuantity}–{tier.toQuantity ?? '∞'} {t(`catalog:units.${rule.unitType}`)} <strong>{formatMoney(tier.unitPrice)} / {t(`catalog:units.${rule.unitType}`)}</strong></span>)}
  </div>
  return <div className="rule-business-summary"><strong>{formatMoney(rule.unitPrice ?? rule.basePrice)} / {t(`catalog:units.${rule.unitType}`)}</strong>
    {rule.minimumQuantity && <span>Tối thiểu {rule.minimumQuantity} {t(`catalog:units.${rule.unitType}`)}</span>}</div>
}

export function PriceListDetailPage() {
  const { priceListId } = useParams()
  const id = Number(priceListId)
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const format = useCatalogFormat()
  const [tab, setTab] = useState<'rules' | 'preview' | 'history'>('rules')
  const [ruleEditor, setRuleEditor] = useState<PriceRule | 'new' | null>(null)
  const [priceListEditorOpen, setPriceListEditorOpen] = useState(false)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [deleteRuleTarget, setDeleteRuleTarget] = useState<PriceRule | null>(null)
  const [confirm, setConfirm] = useState<'publish' | 'archive' | null>(null)
  const query = useQuery({ queryKey: ['price-list', id], queryFn: () => catalogApi.priceList(id), enabled: Number.isFinite(id) })
  const coverage = useQuery({ queryKey: ['price-list-coverage', id], queryFn: () => catalogApi.coverage(id), enabled: Number.isFinite(id) })
  const history = useQuery({ queryKey: ['price-list-history', id], queryFn: () => catalogApi.history(id), enabled: tab === 'history' && hasPermission(PERMISSION_CODES.PRICING_READ_HISTORY) })
  const lifecycle = useMutation<PriceListDetail | PriceList, unknown, 'publish' | 'archive'>({
    mutationFn: (action: 'publish' | 'archive') => action === 'publish'
      ? catalogApi.publishPriceList(id, query.data!.priceList.version)
      : catalogApi.archivePriceList(id, query.data!.priceList.version),
    onSuccess: (_, action) => {
      toast.notify(action === 'publish' ? t('catalog:publishSuccess') : t('catalog:saveSuccess'))
      setConfirm(null); void queryClient.invalidateQueries({ queryKey: ['price-list', id] })
    },
    onError: (error) => toast.notify({ message: errorMessage(error, t), tone: 'error' }),
  })
  const deleteRule = useMutation({
    mutationFn: (rule: PriceRule) => catalogApi.deleteRule(id, rule.id, rule.rowVersion),
    onSuccess: () => {
      setDeleteRuleTarget(null)
      toast.notify(t('catalog:saveSuccess'))
      void queryClient.invalidateQueries({ queryKey: ['price-list', id] })
    },
    onError: (error) => toast.notify({ message: errorMessage(error, t), tone: 'error' }),
  })
  if (query.isLoading) return <div className="catalog-page"><LoadingState rows={6} /></div>
  if (query.isError || !query.data) return <div className="catalog-page"><ErrorState title={t('catalog:loadErrorTitle')} body={t('catalog:loadErrorBody')} onRetry={() => void query.refetch()} /></div>
  const { priceList, rules } = query.data
  const canConfigureRules = hasPermission(PERMISSION_CODES.SERVICE_READ)
    && hasPermission(PERMISSION_CODES.ITEM_TYPE_READ)
  const availableTabs = [
    'rules',
    ...(hasPermission(PERMISSION_CODES.PRICING_PREVIEW) ? ['preview'] : []),
    ...(hasPermission(PERMISSION_CODES.PRICING_READ_HISTORY) ? ['history'] : []),
  ] as Array<'rules' | 'preview' | 'history'>
  const groupedRules = rules.reduce<Record<string, PriceRule[]>>((groups, rule) => {
    const key = `${rule.service.id}:${rule.service.nameVi}`
    groups[key] = [...(groups[key] ?? []), rule]
    return groups
  }, {})
  return <div className="catalog-page catalog-detail-page">
    <Button type="button" variant="secondary" className="catalog-back" onClick={() => navigate('/catalog/price-lists')}>
      <ArrowLeft size={17} />{t('back')}
    </Button>
    <PageHeader title={priceList.name} subtitle={`${priceList.code} · ${priceList.branch.name}`} actions={<>
      {priceList.status === 'DRAFT' && hasPermission(PERMISSION_CODES.PRICE_LIST_UPDATE_DRAFT) &&
        <Button variant="secondary" onClick={() => setPriceListEditorOpen(true)}><Edit3 size={17} />{t('edit')}</Button>}
      {priceList.status === 'DRAFT' && canConfigureRules && hasPermission(PERMISSION_CODES.PRICE_RULE_CREATE) && <Button variant="create" onClick={() => setRuleEditor('new')}><Plus size={17} aria-hidden="true" />{t('catalog:addRule')}</Button>}
      {hasPermission(PERMISSION_CODES.PRICE_LIST_DUPLICATE) &&
        <Button variant="subtle" onClick={() => setDuplicateOpen(true)}>{t('catalog:duplicate')}</Button>}
      {priceList.status === 'DRAFT' && hasPermission(PERMISSION_CODES.PRICE_LIST_PUBLISH) && <Button onClick={() => setConfirm('publish')}><Send size={17} />{new Date(priceList.effectiveFrom) > new Date() ? t('catalog:schedule') : t('catalog:publish')}</Button>}
      {priceList.status !== 'ARCHIVED' && hasPermission(PERMISSION_CODES.PRICE_LIST_ARCHIVE) && <Button variant="danger" onClick={() => setConfirm('archive')}><Archive size={17} />{t('catalog:archive')}</Button>}
    </>} />
    <section className="stat-card-grid price-list-summary" aria-label={t('catalog:priceLists')}>
      <StatCard tone={statCardTone(priceList.status)} icon={<Activity />} label={t('status')} value={t(`catalog:statuses.${priceList.status}`)} />
      <StatCard tone="primary" icon={<CalendarDays />} label={t('catalog:effectiveFrom')} value={format.date(priceList.effectiveFrom)} />
      <StatCard tone="neutral" icon={<CalendarDays />} label={t('catalog:effectiveTo')} value={format.date(priceList.effectiveTo)} />
      <StatCard tone="operational" icon={<Layers3 />} label={t('catalog:pricingCoverage')} value={coverage.data ? `${coverage.data.coveredCombinationCount}/${coverage.data.eligibleCombinationCount}` : '—'}
        supporting={coverage.data && coverage.data.missingCombinationCount > 0 ? t('catalog:missingPrices', { count: coverage.data.missingCombinationCount }) : undefined} />
    </section>
    {priceList.status !== 'DRAFT' && <Surface variant="subtle" className="catalog-readonly-note"><CircleAlert size={19} /><p>{t('catalog:activeListReadonly')}</p></Surface>}
    <div className="catalog-segmented" role="tablist">
      {availableTabs.map((value) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{t(`catalog:${value}`)}</button>)}
    </div>
    {tab === 'rules' && (rules.length === 0 ? <StatePanel icon={<Layers3 />} title={t('catalog:noRulesTitle')} body={t('catalog:noRulesBody')} /> :
      <div className="rule-service-groups">{Object.entries(groupedRules).map(([key, serviceRules]) => <section className="rule-service-group" key={key}>
        <header><div><h2>{serviceRules[0].service.nameVi}</h2><p>{t('catalog:ruleCount', { count: serviceRules.length })}</p></div>
          {coverage.data?.services.find((item) => item.serviceId === serviceRules[0].service.id) && <span className="coverage-chip">{t('catalog:configuredPrices', { count: coverage.data.services.find((item) => item.serviceId === serviceRules[0].service.id)!.coveredItemTypeCount })}</span>}</header>
        <div className="rule-list">{serviceRules.map((rule) => <article className="rule-card" key={rule.id}>
        <div className="rule-card__title"><div><strong>{rule.service.nameVi}</strong><small>{rule.itemType?.nameVi ?? t('catalog:anyItemType')}</small></div>
          <div className="catalog-record-card__commands"><span className={`status-badge status-badge--${statusTone(rule.status)}`}>{t(`catalog:methods.${rule.pricingMethod}`)}</span>
            {priceList.status === 'DRAFT' && ((canConfigureRules && hasPermission(PERMISSION_CODES.PRICE_RULE_UPDATE_DRAFT)) || hasPermission(PERMISSION_CODES.PRICE_RULE_DELETE_DRAFT)) &&
              <FloatingActionMenu label={t('openMenu')}>
                {canConfigureRules && hasPermission(PERMISSION_CODES.PRICE_RULE_UPDATE_DRAFT) && <button type="button" role="menuitem" onClick={() => setRuleEditor(rule)}><Edit3 size={25} aria-hidden="true" /><span className="action-menu__label">{t('edit')}</span></button>}
                {hasPermission(PERMISSION_CODES.PRICE_RULE_DELETE_DRAFT) && <button type="button" role="menuitem" onClick={() => setDeleteRuleTarget(rule)}><Trash2 size={25} aria-hidden="true" /><span className="action-menu__label">{t('delete')}</span></button>}
              </FloatingActionMenu>}</div></div>
        <PriceRuleSummary rule={rule} formatMoney={format.money} t={t} />
      </article>)}</div></section>)}</div>)}
    {tab === 'preview' && <PricePreviewPanel priceList={priceList} />}
    {tab === 'history' && (history.isLoading ? <LoadingState /> : history.data?.items.length
      ? <CatalogAuditHistory entries={history.data.items} formatDate={format.date} />
      : <StatePanel icon={<Clock3 />} title={t('catalog:history')} body={t('catalog:noPreviewBody')} />)}
    <RuleEditor key={ruleEditor === 'new' ? 'new' : ruleEditor?.id ?? 'closed'} open={ruleEditor !== null}
      rule={ruleEditor === 'new' ? undefined : ruleEditor ?? undefined} priceList={priceList}
      onClose={() => setRuleEditor(null)} onSaved={() => { setRuleEditor(null); void queryClient.invalidateQueries({ queryKey: ['price-list', id] }) }} />
    <PriceListEditor key={priceListEditorOpen ? `${priceList.id}-${priceList.version}` : 'closed'}
      open={priceListEditorOpen} branchId={priceList.branch.id} priceList={priceList}
      onClose={() => setPriceListEditorOpen(false)} onSaved={() => {
        setPriceListEditorOpen(false)
        void queryClient.invalidateQueries({ queryKey: ['price-list', id] })
      }} />
    <DuplicatePriceListEditor key={duplicateOpen ? `${priceList.id}-duplicate` : 'closed'}
      open={duplicateOpen} priceList={priceList} onClose={() => setDuplicateOpen(false)}
      onSaved={(createdId) => navigate(`/catalog/price-lists/${createdId}`)} />
    <ConfirmDialog open={deleteRuleTarget !== null} onClose={() => setDeleteRuleTarget(null)}
      onConfirm={() => deleteRuleTarget && deleteRule.mutate(deleteRuleTarget)} pending={deleteRule.isPending}
      tone="danger" title={t('catalog:deleteRuleTitle')} body={t('catalog:deleteRuleBody')}
      confirmLabel={t('delete')} />
    <ConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} onConfirm={() => confirm && lifecycle.mutate(confirm)}
      pending={lifecycle.isPending} tone={confirm === 'archive' ? 'danger' : 'primary'}
      title={confirm === 'archive' ? t('catalog:archiveTitle') : t('catalog:publishTitle')}
      body={confirm === 'archive' ? t('catalog:archiveBody') : t('catalog:publishBody')}
      confirmLabel={confirm === 'archive' ? t('catalog:archive') : t('catalog:publish')} />
  </div>
}

function RuleEditor({ open, rule, priceList, onClose, onSaved }: { open: boolean; rule?: PriceRule; priceList: PriceList; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const services = useQuery({ queryKey: ['catalog-services-options'], queryFn: () => catalogApi.services({ status: 'ACTIVE', size: 100 }), enabled: open })
  const items = useQuery({ queryKey: ['catalog-item-types'], queryFn: catalogApi.itemTypes, enabled: open })
  const itemOptions = useMemo(() => flattenItems(items.data ?? []).map((entry) => entry.item), [items.data])
  const [form, setForm] = useState<PriceRulePayload>(() => rule ? {
    serviceId: rule.service.id, itemTypeId: rule.itemType?.id, pricingMethod: rule.pricingMethod,
    unitType: rule.unitType, sharingMode: rule.sharingMode, priorityLevel: rule.priorityLevel,
    basePrice: rule.basePrice, unitPrice: rule.unitPrice, minimumQuantity: rule.minimumQuantity,
    maximumQuantity: rule.maximumQuantity, minimumCharge: rule.minimumCharge,
    includedQuantity: rule.includedQuantity, excessUnitPrice: rule.excessUnitPrice,
    tierCalculationMode: rule.tierCalculationMode, rulePriority: rule.rulePriority,
    effectiveFrom: rule.effectiveFrom, effectiveTo: rule.effectiveTo, tiers: rule.tiers,
    packagePrices: rule.packagePrices, rowVersion: rule.rowVersion,
  } : {
    serviceId: 0, pricingMethod: 'BY_WEIGHT', unitType: 'KG', sharingMode: 'ANY',
    rulePriority: 0, effectiveFrom: priceList.effectiveFrom, effectiveTo: priceList.effectiveTo, tiers: [], packagePrices: [],
  })
  const eligibility = useQuery({
    queryKey: ['service-eligibility', form.serviceId], queryFn: () => catalogApi.serviceEligibility(form.serviceId),
    enabled: open && form.serviceId > 0,
  })
  const eligibleIds = useMemo(() => new Set(eligibility.data?.eligibleItemTypes.map((item) => item.id) ?? []), [eligibility.data])
  const eligibleItems = itemOptions.filter((item) => eligibleIds.has(item.id) && item.status === 'ACTIVE')
  const mutation = useMutation({
    mutationFn: () => rule ? catalogApi.updateRule(priceList.id, rule.id, form) : catalogApi.addRule(priceList.id, form),
    onSuccess: () => { toast.notify(t('catalog:saveSuccess')); onSaved() },
    onError: (error) => toast.notify({ message: errorMessage(error, t), tone: 'error' }),
  })
  const set = <K extends keyof PriceRulePayload>(key: K, value: PriceRulePayload[K]) => setForm((current) => ({ ...current, [key]: value }))
  const methodUnit = (method: PricingMethod): UnitType => ({ BY_WEIGHT: 'KG', BY_ITEM: 'ITEM', BY_PAIR: 'PAIR', BY_SET: 'SET', FIXED: 'FIXED', PER_LOAD: 'LOAD', HYBRID: 'KG', QUANTITY_PACKAGE: 'ITEM' })[method] as UnitType
  const methodForUnit = (unit: UnitType): PricingMethod => ({ KG: 'BY_WEIGHT', ITEM: 'BY_ITEM', PAIR: 'BY_PAIR', SET: 'BY_SET', LOAD: 'PER_LOAD', FIXED: 'FIXED' })[unit] as PricingMethod
  const chooseMethod = (method: PricingMethod, unit?: UnitType, tierCalculationMode?: TierCalculationMode) => setForm((current) => ({
    ...current, pricingMethod: method, unitType: unit ?? methodUnit(method), tierCalculationMode,
    minimumQuantity: method === 'QUANTITY_PACKAGE' ? undefined : current.minimumQuantity,
    tiers: tierCalculationMode ? (current.tiers.length ? current.tiers : [{ fromQuantity: 0, unitPrice: 0, sortOrder: 0 }]) : [],
    packagePrices: method === 'QUANTITY_PACKAGE' ? (current.packagePrices.length ? current.packagePrices : [{ quantity: 1, totalPrice: 0, sortOrder: 0 }]) : [],
  }))
  const moneyField = (key: 'basePrice' | 'unitPrice' | 'minimumCharge' | 'excessUnitPrice', label: string) =>
    <MoneyInput label={label} value={form[key] == null ? '' : String(form[key])}
      onValueChange={(value) => set(key, value ? Number(value) : undefined)} />
  return <OverlayDialog open={open} onClose={onClose} variant="drawer" title={rule ? t('catalog:editRule') : t('catalog:addRule')}
    description={t('catalog:ruleDrawerDescription')}
    footer={<><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button variant={rule ? 'primary' : 'create'} disabled={!form.serviceId || eligibleItems.length === 0} loading={mutation.isPending} onClick={() => mutation.mutate()}>{t('save')}</Button></>}>
    <div className="catalog-drawer-form rule-editor">
      <DrawerSectionHeading icon={<Layers3 size={19} />} title={t('catalog:scope')} body={t('catalog:eligibleItemsHint')} />
      <Field label={t('catalog:service')} required><select value={form.serviceId || ''} onChange={(e) => {
        const serviceId = Number(e.target.value); const selected = services.data?.items.find((item) => item.id === serviceId)
        const unit = selected?.defaultUnitType ?? 'KG'; setForm((current) => ({ ...current, serviceId,
          itemTypeId: undefined, unitType: unit, pricingMethod: methodForUnit(unit) }))
      }}><option value="">—</option>{services.data?.items.map((service) => <option key={service.id} value={service.id}>{service.nameVi}</option>)}</select></Field>
      {form.serviceId > 0 && !eligibility.isLoading && eligibleItems.length === 0
        ? <div className="catalog-inline-warning"><CircleAlert size={18} /><span>{t('catalog:noEligibleItems')}</span></div>
        : <Field label={t('catalog:itemType')} hint={t('catalog:anyItemType')}><select value={form.itemTypeId ?? ''} onChange={(e) => set('itemTypeId', e.target.value ? Number(e.target.value) : undefined)}><option value="">{t('catalog:anyItemType')}</option>{eligibleItems.map((item) => <option key={item.id} value={item.id}>{item.nameVi}</option>)}</select></Field>}
      <DrawerSectionHeading icon={<Calculator size={19} />} title={t('catalog:method')} body={t('catalog:methodUnitHint')} />
      <div className="pricing-method-grid" role="radiogroup" aria-label={t('catalog:method')}>
        <button type="button" role="radio" aria-checked={['BY_WEIGHT','BY_ITEM','BY_PAIR','BY_SET'].includes(form.pricingMethod) && !form.tierCalculationMode}
          onClick={() => chooseMethod(methodForUnit(form.unitType), form.unitType)}><strong>{t('catalog:methodUnit')}</strong><span>{t('catalog:methodUnitHint')}</span></button>
        <button type="button" role="radio" aria-checked={form.pricingMethod === 'HYBRID'} onClick={() => chooseMethod('HYBRID', form.unitType === 'FIXED' ? 'KG' : form.unitType)}><strong>{t('catalog:methodHybrid')}</strong><span>{t('catalog:methodHybridHint')}</span></button>
        <button type="button" role="radio" aria-checked={form.pricingMethod === 'QUANTITY_PACKAGE'} onClick={() => chooseMethod('QUANTITY_PACKAGE', ['ITEM','PAIR','SET'].includes(form.unitType) ? form.unitType : 'ITEM')}><strong>{t('catalog:methodPackage')}</strong><span>{t('catalog:methodPackageHint')}</span></button>
        <button type="button" role="radio" aria-checked={form.pricingMethod === 'PER_LOAD'} onClick={() => chooseMethod('PER_LOAD', 'LOAD')}><strong>{t('catalog:methodLoad')}</strong><span>120.000đ / mẻ</span></button>
        <button type="button" role="radio" aria-checked={form.pricingMethod === 'FIXED'} onClick={() => chooseMethod('FIXED', 'FIXED')}><strong>{t('catalog:methodFixed')}</strong><span>50.000đ / lần</span></button>
        <button type="button" role="radio" aria-checked={Boolean(form.tierCalculationMode)} onClick={() => {
          const tierUnit = ['KG','ITEM','PAIR','SET'].includes(form.unitType) ? form.unitType : 'KG'
          chooseMethod(methodForUnit(tierUnit), tierUnit, 'VOLUME')
        }}><strong>{t('catalog:methodTier')}</strong><span>{t('catalog:tierModes.VOLUME')}</span></button>
      </div>
      <Field label={t('catalog:unit')} required><select value={form.unitType} onChange={(e) => { const unit = e.target.value as UnitType; setForm((current) => ({ ...current, unitType: unit,
        pricingMethod: current.pricingMethod === 'QUANTITY_PACKAGE' ? 'QUANTITY_PACKAGE' : methodForUnit(unit) })) }}>{UNITS.filter((unit) => {
          if (form.pricingMethod === 'QUANTITY_PACKAGE') return ['ITEM','PAIR','SET'].includes(unit)
          if (form.tierCalculationMode) return ['KG','ITEM','PAIR','SET'].includes(unit)
          return true
        }).map((unit) => <option key={unit} value={unit}>{t(`catalog:units.${unit}`)}</option>)}</select></Field>
      <DrawerSectionHeading icon={<Settings2 size={19} />} title={t('catalog:priceAndLimits')} />
      {form.pricingMethod === 'FIXED' && moneyField('basePrice', t('catalog:basePrice'))}
      {form.pricingMethod === 'HYBRID' && <>{moneyField('basePrice', t('catalog:basePrice'))}
        <Field label={t('catalog:includedQuantity')}><input inputMode="decimal" value={form.includedQuantity ?? ''} onChange={(e) => set('includedQuantity', Number(e.target.value))} /></Field>
        {moneyField('excessUnitPrice', t('catalog:excessUnitPrice'))}</>}
      {form.pricingMethod === 'PER_LOAD' && <>{moneyField('unitPrice', t('catalog:unitPrice'))}<Field label={t('catalog:includedQuantity')}><input inputMode="decimal" value={form.includedQuantity ?? ''} onChange={(e) => set('includedQuantity', e.target.value ? Number(e.target.value) : undefined)} /></Field></>}
      {!['FIXED', 'HYBRID', 'PER_LOAD', 'QUANTITY_PACKAGE'].includes(form.pricingMethod) && !form.tierCalculationMode && moneyField('unitPrice', t('catalog:unitPrice'))}
      {form.pricingMethod === 'QUANTITY_PACKAGE' && <div className="package-price-editor">{form.packagePrices.map((item, index) => <div className="package-price-row" key={index}>
        <Field label={t('catalog:packageQuantity')}><input inputMode="numeric" value={item.quantity} min="1" step="1" onChange={(e) => set('packagePrices', form.packagePrices.map((value, i) => i === index ? { ...value, quantity: Number(e.target.value) } : value))} /></Field>
        <MoneyInput label={t('catalog:packageTotal')} value={String(item.totalPrice)} onValueChange={(value) => set('packagePrices', form.packagePrices.map((entry, i) => i === index ? { ...entry, totalPrice: value ? Number(value) : 0 } : entry))} />
        <Button type="button" variant="danger" size="sm" onClick={() => set('packagePrices', form.packagePrices.filter((_, i) => i !== index))}><Trash2 size={16} />{t('delete')}</Button>
      </div>)}<Button type="button" variant="create" size="sm" onClick={() => set('packagePrices', [...form.packagePrices, { quantity: (form.packagePrices.at(-1)?.quantity ?? 0) + 1, totalPrice: 0, sortOrder: form.packagePrices.length }])}><Plus size={16} />{t('catalog:addPackage')}</Button></div>}
      {!['FIXED', 'QUANTITY_PACKAGE'].includes(form.pricingMethod) && <Field label={t('catalog:minimumQuantity')}><input inputMode="decimal" value={form.minimumQuantity ?? ''} onChange={(e) => set('minimumQuantity', e.target.value ? Number(e.target.value) : undefined)} /></Field>}
      {form.pricingMethod !== 'FIXED' && moneyField('minimumCharge', t('catalog:minimumCharge'))}
      {!['FIXED', 'HYBRID', 'PER_LOAD', 'QUANTITY_PACKAGE'].includes(form.pricingMethod) && <Field label={t('catalog:tierMode')}><select value={form.tierCalculationMode ?? ''} onChange={(e) => {
        const tierCalculationMode = e.target.value ? e.target.value as TierCalculationMode : undefined
        setForm((current) => ({ ...current, tierCalculationMode, tiers: tierCalculationMode && current.tiers.length === 0 ? [{ fromQuantity: 0, unitPrice: current.unitPrice ?? 0, sortOrder: 0 }] : current.tiers }))
      }}><option value="">{t('catalog:noTiers')}</option><option value="VOLUME">{t('catalog:tierModes.VOLUME')}</option><option value="PROGRESSIVE">{t('catalog:tierModes.PROGRESSIVE')}</option></select></Field>}
      {form.tierCalculationMode && <div className="tier-editor">{form.tiers.map((tier, index) => <div className="tier-row" key={index}>
        <Field label={t('catalog:tierFrom')}><input inputMode="decimal" value={tier.fromQuantity} onChange={(e) => set('tiers', form.tiers.map((value, i) => i === index ? { ...value, fromQuantity: Number(e.target.value) } : value))} /></Field>
        <Field label={t('catalog:tierTo')}><input inputMode="decimal" placeholder="∞" value={tier.toQuantity ?? ''} onChange={(e) => set('tiers', form.tiers.map((value, i) => i === index ? { ...value, toQuantity: e.target.value ? Number(e.target.value) : undefined } : value))} /></Field>
        <MoneyInput label={t('catalog:unitPrice')} value={String(tier.unitPrice)}
          onValueChange={(value) => set('tiers', form.tiers.map((tierValue, i) =>
            i === index ? { ...tierValue, unitPrice: value ? Number(value) : 0 } : tierValue))} />
        <Button type="button" variant="danger" size="sm" onClick={() => set('tiers', form.tiers.filter((_, i) => i !== index))}>
          <Trash2 size={16} />{t('catalog:removeTier')}
        </Button>
      </div>)}<Button type="button" variant="create" size="sm" onClick={() => set('tiers', [...form.tiers, { fromQuantity: form.tiers.at(-1)?.toQuantity ?? 0, unitPrice: 0, sortOrder: form.tiers.length }])}><Plus size={16} aria-hidden="true" />{t('add')}</Button></div>}
      <details className="catalog-advanced"><summary>{t('catalog:advancedSettings')}</summary><div className="catalog-advanced__body">
        <Field label={t('catalog:sharingMode')}><select value={form.sharingMode} onChange={(e) => set('sharingMode', e.target.value as SharingMode)}>{SHARING_MODES.map((mode) => <option key={mode} value={mode}>{t(`catalog:modes.${mode}`)}</option>)}</select></Field>
        <Field label={t('catalog:priority')}><input inputMode="numeric" value={form.rulePriority} onChange={(e) => set('rulePriority', Number(e.target.value))} /></Field>
      </div></details>
    </div>
  </OverlayDialog>
}

function PricePreviewPanel({ priceList }: { priceList: PriceList }) {
  const { t } = useTranslation()
  const format = useCatalogFormat()
  const services = useQuery({ queryKey: ['catalog-services-options'], queryFn: () => catalogApi.services({ status: 'ACTIVE', size: 100 }) })
  const itemTree = useQuery({ queryKey: ['catalog-item-types'], queryFn: catalogApi.itemTypes })
  const items = useMemo(() => flattenItems(itemTree.data ?? []).map((entry) => entry.item), [itemTree.data])
  const [form, setForm] = useState({ serviceId: 0, itemTypeId: 0, sharingMode: 'ANY', quantity: 1, effectiveAt: toDateTimeLocal(priceList.effectiveFrom) })
  const eligibility = useQuery({ queryKey: ['service-eligibility', form.serviceId], queryFn: () => catalogApi.serviceEligibility(form.serviceId), enabled: form.serviceId > 0 })
  const eligibleIds = useMemo(() => new Set(eligibility.data?.eligibleItemTypes.map((item) => item.id) ?? []), [eligibility.data])
  const eligibleItems = items.filter((item) => eligibleIds.has(item.id))
  const preview = useMutation({
    mutationFn: () => catalogApi.previewPriceList(priceList.id, {
      branchId: priceList.branch.id, serviceId: form.serviceId,
      itemTypeId: form.itemTypeId || undefined, sharingMode: form.sharingMode,
      quantity: form.quantity, effectiveAt: new Date(form.effectiveAt).toISOString(),
    }),
  })
  return <div className="preview-layout"><Surface variant="subtle" className="preview-form"><h2>{t('catalog:preview')}</h2>
    <Field label={t('catalog:service')} required><select value={form.serviceId || ''} onChange={(e) => setForm({ ...form, serviceId: Number(e.target.value) })}><option value="">—</option>{services.data?.items.map((service) => <option value={service.id} key={service.id}>{service.nameVi}</option>)}</select></Field>
    <Field label={t('catalog:itemType')} required><select value={form.itemTypeId || ''} onChange={(e) => setForm({ ...form, itemTypeId: Number(e.target.value) })}><option value="">—</option>{eligibleItems.map((item) => <option value={item.id} key={item.id}>{item.nameVi}</option>)}</select></Field>
    <Field label={t('catalog:sharingMode')}><select value={form.sharingMode} onChange={(e) => setForm({ ...form, sharingMode: e.target.value })}>{SHARING_MODES.map((mode) => <option value={mode} key={mode}>{t(`catalog:modes.${mode}`)}</option>)}</select></Field>
    <Field label={t('catalog:quantity')} required><input inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></Field>
    <Field label={t('catalog:effectiveAt')}><input type="datetime-local" value={form.effectiveAt} onChange={(e) => setForm({ ...form, effectiveAt: e.target.value })} /></Field>
    <Button loading={preview.isPending} disabled={!form.serviceId || !form.itemTypeId || form.quantity <= 0} onClick={() => preview.mutate()}><Calculator size={18} />{t('catalog:calculate')}</Button>
  </Surface>
    <section className="preview-result">{preview.isError ? <StatePanel compact icon={<CircleAlert />} title={t('catalog:loadErrorTitle')} body={errorMessage(preview.error, t)} />
      : !preview.data ? <StatePanel compact icon={<Sparkles />} title={t('catalog:noPreviewTitle')} body={t('catalog:noPreviewBody')} />
        : <><div className="preview-result__total"><small>{t('catalog:total')}</small><strong>{format.money(preview.data.finalAmount)}</strong><span>{preview.data.serviceName}</span></div>
          <dl className="preview-breakdown">{preview.data.pricingComponents.map((component, index) => <div key={`${component.type}-${index}`}><dt>{component.label}</dt><dd>{component.quantity && component.unitPrice ? `${component.quantity} × ${format.money(component.unitPrice)}` : format.money(component.amount)}</dd></div>)}
            <div className="preview-breakdown__total"><dt>{t('catalog:total')}</dt><dd>{format.money(preview.data.finalAmount)}</dd></div></dl>
          <div className="preview-explanation"><strong>{t('catalog:explanation')}</strong><p>{preview.data.explanation}</p></div>
          <details className="catalog-advanced"><summary>{t('catalog:technicalInfo')}</summary><dl className="preview-breakdown"><div><dt>{t('catalog:selectedPriceList')}</dt><dd>{preview.data.priceListName} · #{preview.data.priceListId}</dd></div><div><dt>{t('catalog:selectedRule')}</dt><dd>#{preview.data.priceRuleId} · v{preview.data.priceRuleVersion}</dd></div><div><dt>Explanation code</dt><dd>{preview.data.explanationCode}</dd></div></dl></details></>}
    </section></div>
}
