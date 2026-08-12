import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive, ArrowLeft, Boxes, Calculator, ChevronRight, CircleAlert, Clock3, Edit3,
  Layers3, PackagePlus, Plus, Search, Send, Shirt, Sparkles, Trash2,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { Field } from '../../components/Field'
import { MoneyInput } from '../../components/MoneyInput'
import { LiquidNavLink } from '../../components/navigation/LiquidNavLink'
import { ConfirmDialog, OverlayDialog } from '../../components/OverlayDialog'
import { ErrorState, LoadingState, StatePanel } from '../../components/States'
import { GlassSurface } from '../../components/glass/GlassSurface'
import { Button, ButtonLink } from '../../components/ui/Button'
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
const PRICING_METHODS: PricingMethod[] = ['BY_WEIGHT', 'BY_ITEM', 'BY_PAIR', 'BY_SET', 'FIXED', 'PER_LOAD', 'HYBRID']
const SHARING_MODES: SharingMode[] = ['ANY', 'SHARED_STANDARD', 'SHARED_PRIORITY', 'PRIVATE_LOAD']

function statusTone(status: string) {
  if (status === 'ACTIVE') return 'success'
  if (status === 'DRAFT') return 'info'
  if (status === 'SCHEDULED') return 'warning'
  if (status === 'ARCHIVED' || status === 'EXPIRED') return 'neutral'
  return 'warning'
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
  return <GlassSurface variant="subtle" as="nav" className="catalog-module-tabs" aria-label={t('catalog:navigation')}>
    <LiquidNavLink to="/catalog/services" className="catalog-module-tab" activeClassName="catalog-module-tab--active"
      indicatorId="catalog-module-active"><Shirt size={18} />{t('catalog:services')}</LiquidNavLink>
    <LiquidNavLink to="/catalog/item-types" className="catalog-module-tab" activeClassName="catalog-module-tab--active"
      indicatorId="catalog-module-active"><Boxes size={18} />{t('catalog:itemTypes')}</LiquidNavLink>
    <LiquidNavLink to="/catalog/price-lists" className="catalog-module-tab" activeClassName="catalog-module-tab--active"
      indicatorId="catalog-module-active"><Layers3 size={18} />{t('catalog:priceLists')}</LiquidNavLink>
  </GlassSurface>
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
        ? <Button onClick={() => setEditor('new')}><Plus size={18} />{t('catalog:addService')}</Button> : undefined
    } />
    <CatalogTabs />
    <GlassSurface variant="subtle" className="catalog-toolbar">
      <label className="catalog-search"><Search size={18} /><span className="sr-only">{t('search')}</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('catalog:searchServices')} />
      </label>
      <select value={status} onChange={(event) => setStatus(event.target.value as CatalogStatus | '')} aria-label={t('status')}>
        <option value="">{t('catalog:allStatuses')}</option>
        <option value="ACTIVE">{t('catalog:statuses.ACTIVE')}</option>
        <option value="INACTIVE">{t('catalog:statuses.INACTIVE')}</option>
        <option value="ARCHIVED">{t('catalog:statuses.ARCHIVED')}</option>
      </select>
    </GlassSurface>
    {query.isLoading ? <LoadingState rows={5} /> : query.isError
      ? <ErrorState title={t('catalog:loadErrorTitle')} body={t('catalog:loadErrorBody')} onRetry={() => void query.refetch()} />
      : services.length === 0
        ? <StatePanel icon={<Shirt />} title={t('catalog:noServicesTitle')} body={t('catalog:noServicesBody')} action={
          hasPermission(PERMISSION_CODES.SERVICE_CREATE) ? <Button onClick={() => setEditor('new')}>{t('catalog:addService')}</Button> : undefined
        } />
        : <>
          <div className="catalog-mobile-list">
            {services.map((service) => <article className="catalog-record-card" key={service.id}>
              <div className="catalog-record-card__heading"><div><strong>{service.nameVi}</strong><small>{service.code}</small></div>
                <span className={`status-badge status-badge--${statusTone(service.status)}`}>{t(`catalog:statuses.${service.status}`)}</span></div>
              <dl><div><dt>{t('catalog:processingType')}</dt><dd>{t(`catalog:processing.${service.processingType}`)}</dd></div>
                <div><dt>{t('catalog:defaultUnit')}</dt><dd>{t(`catalog:units.${service.defaultUnitType}`)}</dd></div>
                <div><dt>{t('catalog:sharingAllowed')}</dt><dd>{service.sharingAllowed ? t('yes') : t('no')}</dd></div></dl>
              <div className="catalog-record-card__actions">
                {hasPermission(PERMISSION_CODES.SERVICE_UPDATE) && service.status !== 'ARCHIVED' &&
                  <Button variant="secondary" size="sm" onClick={() => setEditor(service)}><Edit3 size={16} />{t('edit')}</Button>}
                {hasPermission(PERMISSION_CODES.SERVICE_ARCHIVE) && service.status !== 'ARCHIVED' &&
                  <Button variant="outline" size="sm" loading={statusMutation.isPending} onClick={() => statusMutation.mutate({
                    service, next: service.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                  })}>{service.status === 'ACTIVE' ? t('catalog:statuses.INACTIVE') : t('catalog:statuses.ACTIVE')}</Button>}
              </div>
            </article>)}
          </div>
          <div className="catalog-table-wrap"><table className="catalog-table"><thead><tr>
            <th>{t('catalog:service')}</th><th>{t('catalog:processingType')}</th><th>{t('catalog:defaultUnit')}</th>
            <th>{t('catalog:sharingAllowed')}</th><th>{t('status')}</th><th>{t('catalog:updated')}</th><th>{t('actions')}</th>
          </tr></thead><tbody>{services.map((service) => <tr key={service.id}>
            <td><strong>{service.nameVi}</strong><small>{service.code}</small></td>
            <td>{t(`catalog:processing.${service.processingType}`)}</td><td>{t(`catalog:units.${service.defaultUnitType}`)}</td>
            <td>{service.sharingAllowed ? t('yes') : t('no')}</td>
            <td><span className={`status-badge status-badge--${statusTone(service.status)}`}>{t(`catalog:statuses.${service.status}`)}</span></td>
            <td>{format.date(service.updatedAt)}</td><td>{hasPermission(PERMISSION_CODES.SERVICE_UPDATE) && service.status !== 'ARCHIVED' &&
              <Button variant="secondary" size="sm" onClick={() => setEditor(service)}><Edit3 size={16} />{t('edit')}</Button>}</td>
          </tr>)}</tbody></table></div>
        </>}
    <ServiceEditor key={editor === 'new' ? 'new' : editor?.id ?? 'closed'} open={editor !== null}
      service={editor === 'new' ? undefined : editor ?? undefined} onClose={() => setEditor(null)}
      onSaved={() => { setEditor(null); void queryClient.invalidateQueries({ queryKey: ['catalog-services'] }) }} />
  </div>
}

function ServiceEditor({ open, service, onClose, onSaved }: { open: boolean; service?: LaundryService; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState<ServicePayload>(() => service ? {
    nameVi: service.nameVi, nameEn: service.nameEn, descriptionVi: service.descriptionVi,
    descriptionEn: service.descriptionEn, processingType: service.processingType,
    defaultUnitType: service.defaultUnitType, sharingAllowed: service.sharingAllowed,
    estimatedMinutes: service.estimatedMinutes, minimumQuantity: service.minimumQuantity, version: service.version,
  } : { nameVi: '', processingType: 'WASH_DRY', defaultUnitType: 'KG', sharingAllowed: true })
  const mutation = useMutation({
    mutationFn: () => service ? catalogApi.updateService(service.id, form) : catalogApi.createService(form),
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
    footer={<><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button loading={mutation.isPending} onClick={submitForm}>{t('save')}</Button></>}>
    <form className="catalog-form" onSubmit={submit}>
      <Field label={t('catalog:nameVi')} required error={submitted && !form.nameVi.trim() ? t('catalog:requiredName') : undefined}>
        <input value={form.nameVi} required onChange={(e) => set('nameVi', e.target.value)} />
      </Field>
      <Field label={t('catalog:description')}><textarea value={form.descriptionVi ?? ''} onChange={(e) => set('descriptionVi', e.target.value)} /></Field>
      <Field label={t('catalog:processingType')} required><select value={form.processingType} onChange={(e) => set('processingType', e.target.value as ProcessingType)}>
        {PROCESSING_TYPES.map((value) => <option value={value} key={value}>{t(`catalog:processing.${value}`)}</option>)}</select></Field>
      <Field label={t('catalog:defaultUnit')} required><select value={form.defaultUnitType} onChange={(e) => set('defaultUnitType', e.target.value as UnitType)}>
        {UNITS.map((value) => <option value={value} key={value}>{t(`catalog:units.${value}`)}</option>)}</select></Field>
      <Field label={t('catalog:estimatedMinutes')}><input inputMode="numeric" value={form.estimatedMinutes ?? ''} onChange={(e) => set('estimatedMinutes', e.target.value ? Number(e.target.value) : undefined)} /></Field>
      <Field label={t('catalog:minimumQuantity')}><input inputMode="decimal" value={form.minimumQuantity ?? ''} onChange={(e) => set('minimumQuantity', e.target.value ? Number(e.target.value) : undefined)} /></Field>
      <label className="catalog-check"><input type="checkbox" checked={form.sharingAllowed} onChange={(e) => set('sharingAllowed', e.target.checked)} /><span><strong>{t('catalog:sharingAllowed')}</strong><small>{t('catalog:sharingAllowedHint')}</small></span></label>
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
        ? <Button onClick={() => setEditor({})}><Plus size={18} />{t('catalog:addItemType')}</Button> : undefined
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
                <div><dt>{t('catalog:separateWash')}</dt><dd>{selected.requiresSeparateWash ? t('yes') : t('no')}</dd></div></dl>
              <div className="item-detail__actions">
                {hasPermission(PERMISSION_CODES.ITEM_TYPE_UPDATE) && selected.status !== 'ARCHIVED' && <Button variant="secondary" onClick={() => setEditor({ item: selected })}><Edit3 size={17} />{t('edit')}</Button>}
                {hasPermission(PERMISSION_CODES.ITEM_TYPE_CREATE) && selected.status !== 'ARCHIVED' && <Button variant="subtle" onClick={() => setEditor({ parentId: selected.id })}><PackagePlus size={17} />{t('catalog:addChild')}</Button>}
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
    footer={<><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button loading={mutation.isPending} onClick={submit}>{t('save')}</Button></>}>
    <div className="catalog-form">
      <Field label={t('catalog:nameVi')} required error={submitted && !form.nameVi.trim() ? t('catalog:requiredName') : undefined}>
        <input required value={form.nameVi} onChange={(e) => set('nameVi', e.target.value)} />
      </Field>
      <Field label={t('catalog:parent')}><select value={form.parentId ?? ''} onChange={(e) => set('parentId', e.target.value ? Number(e.target.value) : undefined)}>
        <option value="">{t('catalog:rootItem')}</option>{items.filter((candidate) => candidate.id !== item?.id && candidate.status !== 'ARCHIVED').map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.nameVi}</option>)}</select></Field>
      <Field label={t('catalog:defaultUnit')} hint={t('catalog:inherited')}><select value={form.defaultUnitType ?? ''} onChange={(e) => set('defaultUnitType', e.target.value ? e.target.value as UnitType : undefined)}>
        <option value="">{t('catalog:inherited')}</option>{UNITS.map((unit) => <option key={unit} value={unit}>{t(`catalog:units.${unit}`)}</option>)}</select></Field>
      <Field label={t('catalog:sortOrder')}><input inputMode="numeric" value={form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} /></Field>
      <Field label={t('catalog:description')}><textarea value={form.descriptionVi ?? ''} onChange={(e) => set('descriptionVi', e.target.value)} /></Field>
      <label className="catalog-check"><input type="checkbox" checked={form.requiresSeparateWash} onChange={(e) => set('requiresSeparateWash', e.target.checked)} /><span><strong>{t('catalog:separateWash')}</strong></span></label>
    </div>
  </OverlayDialog>
}

export function PriceListPage() {
  const { t } = useTranslation()
  const { branchId, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const queryClient = useQueryClient()
  const format = useCatalogFormat()
  const query = useQuery({
    queryKey: ['price-lists', branchId, search],
    queryFn: () => catalogApi.priceLists({ branchId: branchId ?? undefined, search: search || undefined, size: 100 }),
    enabled: branchId !== null,
  })
  const lists = query.data?.items ?? []
  return <div className="catalog-page">
    <PageHeader title={t('catalog:priceLists')} subtitle={t('catalog:priceListsSubtitle')} actions={
      hasPermission(PERMISSION_CODES.PRICE_LIST_CREATE)
        ? <Button onClick={() => setEditorOpen(true)}><Plus size={18} />{t('catalog:addPriceList')}</Button> : undefined
    } />
    <CatalogTabs />
    <GlassSurface variant="subtle" className="catalog-toolbar"><label className="catalog-search"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('catalog:searchPriceLists')} /></label></GlassSurface>
    {query.isLoading ? <LoadingState rows={4} /> : query.isError
      ? <ErrorState title={t('catalog:loadErrorTitle')} body={t('catalog:loadErrorBody')} onRetry={() => void query.refetch()} />
      : lists.length === 0 ? <StatePanel icon={<Layers3 />} title={t('catalog:noPricesTitle')} body={t('catalog:noPricesBody')} />
        : <>
          <div className="catalog-mobile-list price-list-grid">{lists.map((list) => <article className="price-list-card" key={list.id}>
            <div className="price-list-card__top"><div><small>{list.code}</small><h2>{list.name}</h2></div><span className={`status-badge status-badge--${statusTone(list.status)}`}>{t(`catalog:statuses.${list.status}`)}</span></div>
            <dl><div><dt>{t('catalog:branch')}</dt><dd>{list.branch.name}</dd></div><div><dt>{t('catalog:effectiveFrom')}</dt><dd>{format.date(list.effectiveFrom)}</dd></div><div><dt>{t('catalog:ruleCount', { count: list.ruleCount })}</dt><dd>{list.ruleCount}</dd></div></dl>
            <ButtonLink to={`/catalog/price-lists/${list.id}`} variant="secondary">{t('catalog:view')}<ChevronRight size={17} /></ButtonLink>
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
            <td><ButtonLink to={`/catalog/price-lists/${list.id}`} variant="secondary" size="sm">{t('catalog:view')}</ButtonLink></td>
          </tr>)}</tbody></table></div>
        </>}
    {branchId && <PriceListEditor key={editorOpen ? 'open' : 'closed'} open={editorOpen} branchId={branchId}
      onClose={() => setEditorOpen(false)} onSaved={(id) => {
      setEditorOpen(false); void queryClient.invalidateQueries({ queryKey: ['price-lists'] }); navigate(`/catalog/price-lists/${id}`)
    }} />}
  </div>
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
    footer={<><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button disabled={!form.name || !form.effectiveFrom} loading={mutation.isPending} onClick={() => mutation.mutate()}>{t('save')}</Button></>}>
    <div className="catalog-form"><Field label={t('catalog:priceListName')} required><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label={t('catalog:description')}><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <Field label={t('catalog:effectiveFrom')} required><input type="datetime-local" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} /></Field>
      <Field label={t('catalog:effectiveTo')}><input type="datetime-local" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} /></Field>
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
  return <OverlayDialog open={open} onClose={onClose} variant="drawer" title={t('catalog:duplicateTitle')}
    footer={<><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
      <Button disabled={!form.name || !form.effectiveFrom} loading={mutation.isPending}
        onClick={() => mutation.mutate()}>{t('catalog:duplicate')}</Button></>}>
    <div className="catalog-form">
      <Field label={t('catalog:duplicateName')} required>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      </Field>
      <Field label={t('catalog:effectiveFrom')} required>
        <input type="datetime-local" value={form.effectiveFrom}
          onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} />
      </Field>
      <Field label={t('catalog:effectiveTo')}>
        <input type="datetime-local" value={form.effectiveTo}
          onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })} />
      </Field>
    </div>
  </OverlayDialog>
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
  return <div className="catalog-page catalog-detail-page">
    <Button type="button" variant="secondary" className="catalog-back" onClick={() => navigate('/catalog/price-lists')}>
      <ArrowLeft size={17} />{t('back')}
    </Button>
    <PageHeader title={priceList.name} subtitle={`${priceList.code} · ${priceList.branch.name}`} actions={<>
      {priceList.status === 'DRAFT' && hasPermission(PERMISSION_CODES.PRICE_LIST_UPDATE_DRAFT) &&
        <Button variant="secondary" onClick={() => setPriceListEditorOpen(true)}><Edit3 size={17} />{t('edit')}</Button>}
      {priceList.status === 'DRAFT' && hasPermission(PERMISSION_CODES.PRICE_RULE_CREATE) && <Button variant="secondary" onClick={() => setRuleEditor('new')}><Plus size={17} />{t('catalog:addRule')}</Button>}
      {hasPermission(PERMISSION_CODES.PRICE_LIST_DUPLICATE) &&
        <Button variant="subtle" onClick={() => setDuplicateOpen(true)}>{t('catalog:duplicate')}</Button>}
      {priceList.status === 'DRAFT' && hasPermission(PERMISSION_CODES.PRICE_LIST_PUBLISH) && <Button onClick={() => setConfirm('publish')}><Send size={17} />{new Date(priceList.effectiveFrom) > new Date() ? t('catalog:schedule') : t('catalog:publish')}</Button>}
      {priceList.status !== 'ARCHIVED' && hasPermission(PERMISSION_CODES.PRICE_LIST_ARCHIVE) && <Button variant="danger" onClick={() => setConfirm('archive')}><Archive size={17} />{t('catalog:archive')}</Button>}
    </>} />
    <GlassSurface variant="standard" className="price-list-summary"><span className={`status-badge status-badge--${statusTone(priceList.status)}`}>{t(`catalog:statuses.${priceList.status}`)}</span>
      <dl><div><dt>{t('catalog:effectiveFrom')}</dt><dd>{format.date(priceList.effectiveFrom)}</dd></div><div><dt>{t('catalog:effectiveTo')}</dt><dd>{format.date(priceList.effectiveTo)}</dd></div><div><dt>{t('catalog:ruleCount', { count: rules.length })}</dt><dd>{rules.length}</dd></div></dl></GlassSurface>
    <div className="catalog-segmented" role="tablist">
      {(['rules', 'preview', 'history'] as const).map((value) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{t(`catalog:${value}`)}</button>)}
    </div>
    {tab === 'rules' && (rules.length === 0 ? <StatePanel icon={<Layers3 />} title={t('catalog:noRulesTitle')} body={t('catalog:noRulesBody')} /> :
      <div className="rule-list">{rules.map((rule) => <article className="rule-card" key={rule.id}>
        <div className="rule-card__title"><div><strong>{rule.service.nameVi}</strong><small>{rule.itemType?.nameVi ?? t('catalog:anyItemType')}</small></div>
          <span className={`status-badge status-badge--${statusTone(rule.status)}`}>{t(`catalog:methods.${rule.pricingMethod}`)}</span></div>
        <dl><div><dt>{t('catalog:sharingMode')}</dt><dd>{t(`catalog:modes.${rule.sharingMode}`)}</dd></div>
          <div><dt>{t('catalog:unit')}</dt><dd>{t(`catalog:units.${rule.unitType}`)}</dd></div>
          <div><dt>{t('catalog:unitPrice')}</dt><dd>{rule.unitPrice !== undefined ? format.money(rule.unitPrice) : rule.basePrice !== undefined ? format.money(rule.basePrice) : '—'}</dd></div></dl>
        {priceList.status === 'DRAFT' && <div className="rule-card__actions">
          {hasPermission(PERMISSION_CODES.PRICE_RULE_UPDATE_DRAFT) &&
            <Button variant="secondary" size="sm" onClick={() => setRuleEditor(rule)}><Edit3 size={16} />{t('edit')}</Button>}
          {hasPermission(PERMISSION_CODES.PRICE_RULE_DELETE_DRAFT) &&
            <Button variant="danger" size="sm" onClick={() => setDeleteRuleTarget(rule)}><Trash2 size={16} />{t('delete')}</Button>}
        </div>}
      </article>)}</div>)}
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
    effectiveFrom: rule.effectiveFrom, effectiveTo: rule.effectiveTo, tiers: rule.tiers, rowVersion: rule.rowVersion,
  } : {
    serviceId: 0, pricingMethod: 'BY_WEIGHT', unitType: 'KG', sharingMode: 'ANY',
    rulePriority: 0, effectiveFrom: priceList.effectiveFrom, effectiveTo: priceList.effectiveTo, tiers: [],
  })
  const mutation = useMutation({
    mutationFn: () => rule ? catalogApi.updateRule(priceList.id, rule.id, form) : catalogApi.addRule(priceList.id, form),
    onSuccess: () => { toast.notify(t('catalog:saveSuccess')); onSaved() },
    onError: (error) => toast.notify({ message: errorMessage(error, t), tone: 'error' }),
  })
  const set = <K extends keyof PriceRulePayload>(key: K, value: PriceRulePayload[K]) => setForm((current) => ({ ...current, [key]: value }))
  const methodUnit = (method: PricingMethod): UnitType => ({ BY_WEIGHT: 'KG', BY_ITEM: 'ITEM', BY_PAIR: 'PAIR', BY_SET: 'SET', FIXED: 'FIXED', PER_LOAD: 'LOAD', HYBRID: 'KG' })[method] as UnitType
  const moneyField = (key: 'basePrice' | 'unitPrice' | 'minimumCharge' | 'excessUnitPrice', label: string) =>
    <MoneyInput label={label} value={form[key] == null ? '' : String(form[key])}
      onValueChange={(value) => set(key, value ? Number(value) : undefined)} />
  return <OverlayDialog open={open} onClose={onClose} variant="drawer" title={rule ? t('catalog:editRule') : t('catalog:addRule')}
    footer={<><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button disabled={!form.serviceId} loading={mutation.isPending} onClick={() => mutation.mutate()}>{t('save')}</Button></>}>
    <div className="catalog-form rule-editor">
      <h3>{t('catalog:scope')}</h3>
      <Field label={t('catalog:service')} required><select value={form.serviceId || ''} onChange={(e) => set('serviceId', Number(e.target.value))}><option value="">—</option>{services.data?.items.map((service) => <option key={service.id} value={service.id}>{service.nameVi}</option>)}</select></Field>
      <Field label={t('catalog:itemType')}><select value={form.itemTypeId ?? ''} onChange={(e) => set('itemTypeId', e.target.value ? Number(e.target.value) : undefined)}><option value="">{t('catalog:anyItemType')}</option>{itemOptions.map((item) => <option key={item.id} value={item.id}>{item.nameVi}</option>)}</select></Field>
      <Field label={t('catalog:sharingMode')}><select value={form.sharingMode} onChange={(e) => set('sharingMode', e.target.value as SharingMode)}>{SHARING_MODES.map((mode) => <option key={mode} value={mode}>{t(`catalog:modes.${mode}`)}</option>)}</select></Field>
      <Field label={t('catalog:priority')}><input inputMode="numeric" value={form.rulePriority} onChange={(e) => set('rulePriority', Number(e.target.value))} /></Field>
      <h3>{t('catalog:method')}</h3>
      <Field label={t('catalog:method')} required><select value={form.pricingMethod} onChange={(e) => { const method = e.target.value as PricingMethod; setForm((current) => ({ ...current, pricingMethod: method, unitType: methodUnit(method), tiers: [] })) }}>{PRICING_METHODS.map((method) => <option key={method} value={method}>{t(`catalog:methods.${method}`)}</option>)}</select></Field>
      <Field label={t('catalog:unit')} required><select value={form.unitType} onChange={(e) => set('unitType', e.target.value as UnitType)}>{UNITS.map((unit) => <option key={unit} value={unit}>{t(`catalog:units.${unit}`)}</option>)}</select></Field>
      <h3>{t('catalog:priceAndLimits')}</h3>
      {form.pricingMethod === 'FIXED' && moneyField('basePrice', t('catalog:basePrice'))}
      {form.pricingMethod === 'HYBRID' && <>{moneyField('basePrice', t('catalog:basePrice'))}
        <Field label={t('catalog:includedQuantity')}><input inputMode="decimal" value={form.includedQuantity ?? ''} onChange={(e) => set('includedQuantity', Number(e.target.value))} /></Field>
        {moneyField('excessUnitPrice', t('catalog:excessUnitPrice'))}</>}
      {form.pricingMethod === 'PER_LOAD' && <>{moneyField('unitPrice', t('catalog:unitPrice'))}<Field label={t('catalog:includedQuantity')}><input inputMode="decimal" value={form.includedQuantity ?? ''} onChange={(e) => set('includedQuantity', e.target.value ? Number(e.target.value) : undefined)} /></Field></>}
      {!['FIXED', 'HYBRID', 'PER_LOAD'].includes(form.pricingMethod) && moneyField('unitPrice', t('catalog:unitPrice'))}
      {!['FIXED'].includes(form.pricingMethod) && <><Field label={t('catalog:minimumQuantity')}><input inputMode="decimal" value={form.minimumQuantity ?? ''} onChange={(e) => set('minimumQuantity', e.target.value ? Number(e.target.value) : undefined)} /></Field>{moneyField('minimumCharge', t('catalog:minimumCharge'))}</>}
      {!['FIXED', 'HYBRID', 'PER_LOAD'].includes(form.pricingMethod) && <Field label={t('catalog:tierMode')}><select value={form.tierCalculationMode ?? ''} onChange={(e) => {
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
      </div>)}<Button type="button" variant="subtle" size="sm" onClick={() => set('tiers', [...form.tiers, { fromQuantity: form.tiers.at(-1)?.toQuantity ?? 0, unitPrice: 0, sortOrder: form.tiers.length }])}><Plus size={16} />{t('add')}</Button></div>}
    </div>
  </OverlayDialog>
}

function PricePreviewPanel({ priceList }: { priceList: PriceList }) {
  const { t } = useTranslation()
  const format = useCatalogFormat()
  const services = useQuery({ queryKey: ['catalog-services-options'], queryFn: () => catalogApi.services({ status: 'ACTIVE', size: 100 }) })
  const itemTree = useQuery({ queryKey: ['catalog-item-types'], queryFn: catalogApi.itemTypes })
  const items = useMemo(() => flattenItems(itemTree.data ?? []).map((entry) => entry.item), [itemTree.data])
  const [form, setForm] = useState({ serviceId: 0, itemTypeId: 0, sharingMode: 'ANY', quantity: 1, effectiveAt: new Date().toISOString().slice(0, 16) })
  const preview = useMutation({
    mutationFn: () => catalogApi.preview({
      branchId: priceList.branch.id, serviceId: form.serviceId,
      itemTypeId: form.itemTypeId || undefined, sharingMode: form.sharingMode,
      quantity: form.quantity, effectiveAt: new Date(form.effectiveAt).toISOString(),
    }),
  })
  return <div className="preview-layout"><GlassSurface variant="subtle" className="preview-form"><h2>{t('catalog:preview')}</h2>
    <Field label={t('catalog:service')} required><select value={form.serviceId || ''} onChange={(e) => setForm({ ...form, serviceId: Number(e.target.value) })}><option value="">—</option>{services.data?.items.map((service) => <option value={service.id} key={service.id}>{service.nameVi}</option>)}</select></Field>
    <Field label={t('catalog:itemType')}><select value={form.itemTypeId || ''} onChange={(e) => setForm({ ...form, itemTypeId: Number(e.target.value) })}><option value="">{t('catalog:anyItemType')}</option>{items.map((item) => <option value={item.id} key={item.id}>{item.nameVi}</option>)}</select></Field>
    <Field label={t('catalog:sharingMode')}><select value={form.sharingMode} onChange={(e) => setForm({ ...form, sharingMode: e.target.value })}>{SHARING_MODES.map((mode) => <option value={mode} key={mode}>{t(`catalog:modes.${mode}`)}</option>)}</select></Field>
    <Field label={t('catalog:quantity')} required><input inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></Field>
    <Field label={t('catalog:effectiveAt')}><input type="datetime-local" value={form.effectiveAt} onChange={(e) => setForm({ ...form, effectiveAt: e.target.value })} /></Field>
    <Button loading={preview.isPending} disabled={!form.serviceId || form.quantity <= 0} onClick={() => preview.mutate()}><Calculator size={18} />{t('catalog:calculate')}</Button>
  </GlassSurface>
    <section className="preview-result">{preview.isError ? <StatePanel compact icon={<CircleAlert />} title={t('catalog:loadErrorTitle')} body={errorMessage(preview.error, t)} />
      : !preview.data ? <StatePanel compact icon={<Sparkles />} title={t('catalog:noPreviewTitle')} body={t('catalog:noPreviewBody')} />
        : <><div className="preview-result__total"><small>{t('catalog:total')}</small><strong>{format.money(preview.data.finalAmount)}</strong><span>{preview.data.serviceName}</span></div>
          <dl className="preview-breakdown"><div><dt>{t('catalog:selectedPriceList')}</dt><dd>{preview.data.priceListName}</dd></div><div><dt>{t('catalog:selectedRule')}</dt><dd>#{preview.data.priceRuleId} · v{preview.data.priceRuleVersion}</dd></div>
            <div><dt>{t('catalog:actualQuantity')}</dt><dd>{preview.data.actualQuantity} {t(`catalog:units.${preview.data.unitType}`)}</dd></div>
            <div><dt>{t('catalog:billableQuantity')}</dt><dd>{preview.data.billableQuantity} {t(`catalog:units.${preview.data.unitType}`)}</dd></div>
            <div><dt>{t('catalog:baseAmount')}</dt><dd>{format.money(preview.data.baseAmount)}</dd></div><div><dt>{t('catalog:surcharge')}</dt><dd>{format.money(preview.data.surchargeAmount)}</dd></div></dl>
          <div className="preview-explanation"><strong>{t('catalog:explanation')}</strong><p>{preview.data.explanation}</p><code>{preview.data.explanationCode}</code></div></>}
    </section></div>
}
