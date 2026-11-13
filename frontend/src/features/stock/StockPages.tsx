import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArrowDownToLine, ArrowUpFromLine, PackageSearch } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useBeforeUnload, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES as P, type PermissionCode } from '../../auth/permissionCodes.generated'
import { Field } from '../../components/Field'
import { MoneyInput } from '../../components/MoneyInput'
import { ConfirmDialog, OverlayDialog } from '../../components/OverlayDialog'
import { UnsavedBranchDialog } from '../../components/UnsavedBranchDialog'
import { ErrorState, LoadingState, PermissionDeniedState, StatePanel } from '../../components/States'
import { Button, ButtonLink } from '../../components/ui/Button'
import { CollapsibleFilterPanel } from '../../components/ui/CollapsibleFilterPanel'
import { StockDatePicker as DatePickerField } from './StockDatePicker'
import { DateTimeText } from '../../components/ui/DateTimeText'
import { StatCard } from '../../components/ui/StatCard'
import { Surface } from '../../components/ui/Surface'
import { QuantityFlowChart } from '../../components/ui/QuantityFlowChart'
import { useDebouncedValue } from '../../components/operational-list/useDebouncedValue'
import { useToast } from '../../providers/ToastProvider'
import { ReferenceField } from '../operations/OperationsPages'
import { operationsApi } from '../operations/api'
import { stockApi, query } from './api'
import { createPermissions, decimal, emptyFilters, emptyLine, kinds, type Balance, type Dashboard, type Document, type Filters, type Input, type Ledger, type Line, type Report } from './types'

import { StockNavigation } from './StockNavigation'
import { InvoiceCapture, ReceiptInvoiceImages } from './ReceiptInvoiceImages'
import { uploadInvoiceImage, useInvoiceError, useReceiptInvoicePermissions, type PendingInvoiceImage } from './receiptInvoiceApi'
import { stockPages as pages } from './types'
function stockError(error: unknown, t: (key: string, options?: Record<string, unknown>) => string) {
  if (!(error instanceof ApiError)) return t('error')
  const reason = error.problem.detail?.split(':')[0] ?? ''
  return t(`errors.${reason}`, { defaultValue: error.status === 409 ? t('stale') : t('invalid') })
}
function Failure({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useTranslation('stock')
  return error instanceof ApiError && error.status === 403 ? <PermissionDeniedState /> : <ErrorState title={t('error')} body={stockError(error, t)} onRetry={retry} />
}
function Pagination({ page, count, pages, onPage }: { page: number; count: number; pages: number; onPage: (n: number) => void }) {
  const { t } = useTranslation('stock')
  return <nav className="operations-pagination" aria-label={t('documents')}><span>{t('page', { page: page + 1, count })}</span><Button variant="secondary" disabled={page === 0} onClick={() => onPage(page - 1)}>{t('previous')}</Button><Button variant="secondary" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>{t('next')}</Button></nav>
}
function Lookup({ label, path, permission, branchId, value, onChange, disabled = false, required = false }: { label: string; path: string; permission: PermissionCode; branchId: number; value: string | number | null; onChange: (n: number | null) => void; disabled?: boolean; required?: boolean }) {
  return <div className="form-field"><span className="form-field__label">{label}{required ? ' *' : ''}</span><ReferenceField label={label} field={{ key: label, kind: 'reference', reference: `/inventory/${path}`, readPermission: permission, required }} value={String(value ?? '')} onChange={(v) => onChange(v ? Number(v) : null)} branchId={branchId} disabled={disabled} /></div>
}
function FilterBar({ filters, setFilters, branchId, documents = false }: { filters: Filters; setFilters: (f: Filters) => void; branchId: number; documents?: boolean }) {
  const { t } = useTranslation('stock'); const change = (key: keyof Filters, value: string) => setFilters({ ...filters, [key]: value })
  return <div className="stock-filters"><Field label={t('search')}><input type="search" value={filters.search} maxLength={150} onChange={(e) => change('search', e.target.value)} /></Field>
    <CollapsibleFilterPanel label={t('filters')} activeCount={Object.entries(filters).filter(([k, v]) => k !== 'sort' && k !== 'search' && v).length}>
      <Lookup label={t('warehouse')} path="warehouses" permission={P.INVENTORY_WAREHOUSE_READ} value={filters.warehouseId} branchId={branchId} onChange={(v) => change('warehouseId', String(v ?? ''))} />
      {!documents && <Lookup label={t('category')} path="categories" permission={P.INVENTORY_CATEGORY_READ} value={filters.categoryId} branchId={branchId} onChange={(v) => change('categoryId', String(v ?? ''))} />}
      {documents && <><Lookup label={t('supplier')} path="suppliers" permission={P.INVENTORY_SUPPLIER_READ} value={filters.supplierId} branchId={branchId} onChange={(v) => change('supplierId', String(v ?? ''))} /><Field label={t('statusLabel')}><select value={filters.status} onChange={(e) => change('status', e.target.value)}><option value="">{t('all')}</option>{['DRAFT', 'RECORDED', 'CANCELLED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED'].map((s) => <option value={s} key={s}>{t(`status.${s}`)}</option>)}</select></Field></>}
      <DatePickerField label={t('from')} value={filters.from} onChange={(v) => change('from', v)} /><DatePickerField label={t('to')} value={filters.to} onChange={(v) => change('to', v)} />
      {documents && <Field label={t('sort')}><select value={filters.sort} onChange={(e) => change('sort', e.target.value)}>{['newest', 'oldest', 'code'].map((s) => <option key={s} value={s}>{t(s)}</option>)}</select></Field>}
    </CollapsibleFilterPanel></div>
}
export function StockPage({ resource: specifiedResource }: { resource?: string }) {
  const { resource: routeResource } = useParams(); const resource = specifiedResource ?? routeResource ?? 'dashboard'; const { t } = useTranslation('stock'); const { branchId, hasPermission } = useAuth()
  const page = pages.find((p) => p.path === resource)
  if (!page) return <Navigate to="/inventory/dashboard" replace />
  if (!branchId) return <PermissionDeniedState />
  return <div className="catalog-page operations-workspace"><header className="catalog-page-header"><h1>{t(resource)}</h1><p>{t('saveHint')}</p></header><StockNavigation />
    {!hasPermission(page.permission) ? <PermissionDeniedState /> : <StockContent key={`${resource}/${branchId}`} branchId={branchId} resource={resource} />}
    {kinds[resource] && !hasPermission(page.permission) && hasPermission(createPermissions[kinds[resource]]) && <ButtonLink to={`/inventory/${resource}/new`}>{t('create')}</ButtonLink>}
  </div>
}
function StockContent({ branchId, resource }: { branchId: number; resource: string }) {
  const { t, i18n } = useTranslation('stock'); const { hasPermission } = useAuth(); const { notify } = useToast(); const fmt = (v: string | number | null | undefined) => decimal(v, i18n.language.startsWith('en'))
  const [params] = useSearchParams()
  const [filters, setFilters] = useState<Filters>(() => ({ ...emptyFilters, itemId: params.get('item') ?? '', warehouseId: params.get('warehouse') ?? '' })); const [page, setPage] = useState(0); const debounced = useDebouncedValue(filters, 250); const q = query(branchId, debounced, page, kinds[resource]); const kind = kinds[resource]
  const data = useQuery({ queryKey: ['stock', resource, branchId, debounced, page], queryFn: async () => resource === 'dashboard' ? stockApi.dashboard(q) : kind ? stockApi.documents(q) : resource === 'balances' ? stockApi.balances(q) : resource === 'ledger' ? stockApi.ledger(q) : stockApi.report(q), retry: false })
  const exporting = useMutation({ mutationFn: () => stockApi.export(q), onSuccess: (blob) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'inventory.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }, onError: (e) => notify(stockError(e, t), 'error') })
  const paged = data.data && 'items' in data.data ? data.data : null
  return <>
    <div className="stock-header-actions">{kind && hasPermission(createPermissions[kind]) && <ButtonLink to={`/inventory/${resource}/new`}>{t('create')}</ButtonLink>}{resource === 'reports' && hasPermission(P.INVENTORY_REPORT_EXPORT) && <Button loading={exporting.isPending} onClick={() => exporting.mutate()}>{t('export')}</Button>}</div>
    <Surface className="operations-catalog"><FilterBar filters={filters} setFilters={(f) => { setFilters(f); setPage(0) }} branchId={branchId} documents={!!kind} /></Surface>
    {resource === 'reports' && <p>{t('reportHelp')} {t('exportLimit')}</p>}
    {kind && paged && 'summary' in paged && <p><strong>{t('periodTotal')}: {fmt(paged.summary.totalValue)}</strong> · {paged.totalElements} {t('documents').toLowerCase()}</p>}
    {data.isPending ? <LoadingState /> : data.isError ? <Failure error={data.error} retry={() => void data.refetch()} /> : data.data && !('items' in data.data) ? <DashboardView data={data.data} fmt={fmt} /> : paged && <>
      {paged.items.length === 0 ? <StatePanel title={t('empty')} body={t('emptyBody')} /> : <Surface className="operations-catalog">
        {kind ? <Records rows={paged.items as Document[]} columns={[t('code'), t('date'), t('warehouse'), t('lines'), t('total'), t('statusLabel'), t('actor')]} cells={(r) => [<ButtonLink to={`/inventory/documents/${r.id}`} variant="ghost">{r.code}</ButtonLink>, <DateTimeText value={r.businessAt} />, <>{r.warehouseName}<small>{r.supplierName}</small></>, <>{r.lines.length}<small>{Object.entries(r.quantities).map(([u, n]) => `${fmt(n)} ${u}`).join(' · ')}</small></>, fmt(r.totalValue), t(`status.${r.status}`), r.actorName ?? r.createdBy]} /> :
          resource === 'balances' ? <Records rows={paged.items as Balance[]} columns={[t('item'), t('warehouse'), t('available'), t('averageCost'), t('value')]} cells={(r) => [<>{r.itemName}<small>{r.itemCode}</small></>, r.warehouseName, `${fmt(r.quantity)} ${r.baseUnit}`, fmt(r.averageCost), fmt(r.stockValue)]} /> :
            resource === 'ledger' ? <Records rows={paged.items as Ledger[]} columns={[t('code'), t('item'), t('changedQuantity'), t('afterQuantity'), t('recordedAt')]} cells={(r) => [<ButtonLink to={`/inventory/documents/${r.documentId}`} variant="ghost">{r.code}</ButtonLink>, <>{r.itemName}<small>{r.warehouseName} · {t(`phase.${r.phase}`)}</small></>, `${fmt(r.quantityDelta)} ${r.baseUnit}`, `${fmt(r.quantityAfter)} ${r.baseUnit}`, <DateTimeText value={r.recordedAt} />]} /> :
              <div className="stock-report-list">{(paged.items as Report[]).map((r) => <article className="operations-record" key={`${r.warehouseId}/${r.itemId}`}><h2>{r.itemName}</h2><p>{r.warehouseName} · {r.baseUnit}</p><dl className="stock-values">{(['openingQuantity', 'incomingQuantity', 'outgoingQuantity', 'adjustmentIncrease', 'adjustmentDecrease', 'closingQuantity', 'openingValue', 'incomingValue', 'outgoingValue', 'adjustmentValue', 'closingValue'] as const).map((key) => <div key={key}><dt>{t(({ openingQuantity: 'opening', incomingQuantity: 'incoming', outgoingQuantity: 'outgoing', adjustmentIncrease: 'increase', adjustmentDecrease: 'decrease', closingQuantity: 'closing' } as Record<string, string>)[key] ?? key)}</dt><dd>{fmt(r[key])}</dd></div>)}</dl><ButtonLink to={`/inventory/ledger?item=${r.itemId}&warehouse=${r.warehouseId}`}>{t('ledger')}</ButtonLink></article>)}</div>}
      </Surface>}
      <Pagination page={page} pages={paged.totalPages} count={paged.totalElements} onPage={setPage} />
    </>}
  </>
}
function Records<T>({ rows, columns, cells }: { rows: T[]; columns: string[]; cells: (row: T) => ReactNode[] }) {
  return <><div className="operations-mobile-records">{rows.map((r, i) => <article key={i} className="operations-record"><dl className="stock-values">{cells(r).map((v, j) => <div key={j}><dt>{columns[j]}</dt><dd>{v}</dd></div>)}</dl></article>)}</div><div className="operations-desktop-table"><table><thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{cells(r).map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody></table></div></>
}
function DashboardView({ data, fmt }: { data: Dashboard; fmt: (v: string | number | null) => string }) {
  const { t } = useTranslation('stock')
  return <><div className="stat-card-grid"><StatCard icon={<Archive />} label={t('itemCount')} value={fmt(data.summary.itemCount)} /><StatCard icon={<PackageSearch />} label={t('stockValue')} value={fmt(data.summary.stockValue)} /><StatCard tone="warning" icon={<ArrowDownToLine />} label={t('lowStock')} value={fmt(data.summary.lowStock)} /><StatCard tone="danger" icon={<ArrowUpFromLine />} label={t('outOfStock')} value={fmt(data.summary.outOfStock)} /></div>
    <div className="stock-dashboard-grid"><Surface className="operations-catalog"><h2>{t('byUnit')}</h2>{data.unitTotals.map((u) => <p key={u.baseUnitId}><strong>{fmt(u.quantity)}</strong> {u.baseUnit}</p>)}<h2>{t('transit')}</h2>{data.transit.map((u) => <p key={u.baseUnitId}>{fmt(u.quantity)} {u.baseUnit} · {fmt(u.transitValue)}</p>)}</Surface>
      <Surface className="operations-catalog"><h2>{t('flow')}</h2>{data.flows.map((f) => <div className="stock-flow" key={`${f.kind}/${f.baseUnitId}`}><strong>{t(`kind.${f.kind}`)} · {f.baseUnit}</strong><span>{t('incoming')}: {fmt(f.incomingQuantity)} · {t('outgoing')}: {fmt(f.outgoingQuantity)}</span><span>{t('value')}: {fmt(f.incomingValue)} / {fmt(f.outgoingValue)}</span></div>)}</Surface>
      <Surface className="operations-catalog"><h2>{t('dailyFlow')}</h2><p>{t('chartHelp')}</p>{data.series.length ? <QuantityFlowChart rows={data.series} incomingLabel={t('incoming')} outgoingLabel={t('outgoing')} format={fmt} /> : <p>{t('empty')}</p>}</Surface>
      <Surface className="operations-catalog"><h2>{t('periodValues')}</h2><p>{t('incomingValue')}: {fmt(data.periodValues.receiptValue)}</p><p>{t('outgoingValue')}: {fmt(data.periodValues.issueValue)}</p><h2>{t('consumption')}</h2>{data.consumption.length ? data.consumption.map((r) => <p key={r.itemId}>{r.itemName}: <strong>{fmt(r.quantity)} {r.baseUnit}</strong></p>) : <p>{t('empty')}</p>}</Surface>
      <Surface className="operations-catalog"><h2>{t('recentDocuments')}</h2>{data.recentDocuments.length ? data.recentDocuments.map((r) => <p key={r.id}><ButtonLink variant="ghost" to={`/inventory/documents/${r.id}`}>{r.code}</ButtonLink> · {t(`status.${r.status}`)}</p>) : <p>{t('empty')}</p>}</Surface>
      <Surface className="operations-catalog"><h2>{t('lowStock')}</h2>{data.lowStock.length ? data.lowStock.map((r, i) => <p key={i}>{r.itemName} · {r.warehouseName}: <strong>{fmt(r.quantity)} {r.baseUnit}</strong></p>) : <p>{t('empty')}</p>}</Surface>
      <Surface className="operations-catalog"><h2>{t('expiring')}</h2>{data.expiringLots.length ? data.expiringLots.map((r, i) => <p key={i}>{r.itemName} · {r.lotCode} · {r.expiryDate.split('-').reverse().join('/')} · {fmt(r.quantity)}</p>) : <p>{t('empty')}</p>}</Surface></div></>
}

function toLocal(iso: string) { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
const stockMoneyPattern = /^\d{1,13}(?:[.,]\d{1,2})?$/

function validMoney(value: string | null) {
  return !value || stockMoneyPattern.test(value)
}

function StockMoneyInput(props: Pick<ComponentProps<typeof MoneyInput>, 'label' | 'value' | 'onValueChange' | 'required' | 'disabled'>) {
  const { t } = useTranslation('stock')
  return <MoneyInput {...props} fractionDigits={2} preserveInput hint={t('moneyHint')} error={validMoney(props.value) ? undefined : t('moneyInvalid')} />
}

function normalized(input: Input) {
  return {
    ...input,
    charges: (input.charges || '0').replace(',', '.'),
    lines: input.lines.map((line) => ({
      ...line,
      quantity: line.quantity.replace(',', '.'),
      unitPrice: line.unitPrice ? line.unitPrice.replace(',', '.') : null,
      discount: (line.discount || '0').replace(',', '.'),
      tax: (line.tax || '0').replace(',', '.'),
    })),
  }
}
function editorInput(input: Input, version?: number): Input {
  return { ...input, version, draft: false, charges: input.charges ?? '0', note: input.note ?? '', reason: input.reason ?? '', lines: input.lines.map((l) => ({ ...l, quantity: String(l.quantity ?? ''), discount: l.discount ?? '0', tax: l.tax ?? '0' })) }
}
export function StockEditorPage() {
  const { resource = 'receipts', documentId } = useParams(); const { branchId, hasPermission } = useAuth(); const kind = kinds[resource] ?? 'RECEIPT'
  const detail = useQuery({ queryKey: ['stock', 'detail', documentId, branchId], queryFn: () => stockApi.detail(Number(documentId), branchId!), enabled: !!documentId && !!branchId, retry: false })
  if (!branchId) return <PermissionDeniedState />
  if (!documentId && !kinds[resource]) return <Navigate to="/inventory" replace />
  if (documentId) return detail.isPending ? <LoadingState /> : detail.isError ? <Failure error={detail.error} /> : hasPermission(P.INVENTORY_DOCUMENT_UPDATE) ? <Editor key={`${documentId}/${detail.data.version}/${branchId}`} initial={detail.data.input} saved={detail.data} branchId={detail.data.branchId} /> : <PermissionDeniedState />
  return hasPermission(createPermissions[kind]) ? <Editor key={`${resource}/${branchId}`} branchId={branchId} initial={{ branchId, kind, warehouseId: null, destinationBranchId: kind === 'TRANSFER' ? branchId : null, destinationWarehouseId: null, supplierId: null, businessAt: new Date().toISOString(), issueType: 'CONSUMPTION', note: '', reason: '', charges: '0', draft: false, lines: [emptyLine()] }} /> : <PermissionDeniedState />
}
function Editor({ initial, saved, branchId }: { initial: Input; saved?: Document; branchId: number }) {
  const { t, i18n } = useTranslation('stock'); const { user } = useAuth(); const navigate = useNavigate(); const client = useQueryClient(); const { notify } = useToast()
  const [values, setValues] = useState<Input>(() => editorInput(initial, saved?.version)); const [error, setError] = useState<unknown>(); const [key, setKey] = useState(crypto.randomUUID()); const savedOk = useRef(false); const mutationPending = useRef(false)
  const invoicePermission = useReceiptInvoicePermissions()
  const invoiceError = useInvoiceError()
  const [invoice, setInvoice] = useState<PendingInvoiceImage | null>(null)
  const [recorded, setRecorded] = useState<Document | null>(null)
  const dirty = Boolean(invoice) || (!savedOk.current && JSON.stringify(values) !== JSON.stringify(editorInput(initial, saved?.version)))
  const leavingAfterSave = useRef(false)
  const blocker = useBlocker(() => !leavingAfterSave.current && (dirty || mutationPending.current))
  useBeforeUnload((e) => { if (dirty || mutationPending.current) { e.preventDefault(); e.returnValue = '' } })
  const debounced = useDebouncedValue(values, 400)
  const valid = !!debounced.warehouseId && validMoney(debounced.charges) && debounced.lines.every((line) =>
    line.itemId && line.quantity &&
    (debounced.kind !== 'RECEIPT' || !!line.unitPrice) &&
    (debounced.kind !== 'STOCKTAKE' || line.balanceVersion != null) &&
    [line.unitPrice, line.discount, line.tax].every(validMoney)
  ) && (!['STOCKTAKE', 'ADJUSTMENT'].includes(debounced.kind) || !!debounced.reason.trim())
  const isCurrentPreview = JSON.stringify(values) === JSON.stringify(debounced)
  const captureVersion = useCallback((index: number, warehouseId: number | null, itemId: number | null, version: number, replace: boolean) => {
    if (replace) setKey(crypto.randomUUID())
    setValues((previous) => {
      const line = previous.lines[index]
      if (previous.warehouseId !== warehouseId || !line || line.itemId !== itemId || (!replace && line.balanceVersion != null)) return previous
      return { ...previous, lines: previous.lines.map((entry, position) => position === index ? { ...entry, balanceVersion: version } : entry) }
    })
  }, [])
  const preview = useQuery({ queryKey: ['stock', 'preview', saved?.id, debounced], queryFn: () => stockApi.preview(normalized(debounced), saved?.id), enabled: valid, retry: false })
  const change = (next: Input) => { setValues(next); setError(undefined); setKey(crypto.randomUUID()) }
  function openSaved(documentId: number) {
    leavingAfterSave.current = true
    void client.invalidateQueries({ queryKey: ['stock'] })
    navigate(`/inventory/documents/${documentId}`)
  }
  const attachment = useMutation({
    mutationFn: async ({ documentId, image }: { documentId: number; image: PendingInvoiceImage }) => {
      mutationPending.current = true
      try { return await uploadInvoiceImage(documentId, branchId, image) }
      finally { mutationPending.current = false }
    },
    onSuccess: (_data, { documentId }) => {
      setInvoice(null)
      void client.invalidateQueries({ queryKey: ['receipt-invoices', branchId, documentId] })
      notify(t('invoice.uploaded'))
      openSaved(documentId)
    },
  })
  const mutation = useMutation({
    mutationFn: async (draft: boolean) => {
      mutationPending.current = true
      try { return await stockApi.save(normalized({ ...values, branchId, draft }), key, saved?.id) }
      finally { mutationPending.current = false }
    },
    onSuccess: (d) => {
      savedOk.current = true
      notify(t(d.status === 'DRAFT' ? 'draftSaved' : 'saved'))
      if (invoice && invoicePermission.upload) {
        setRecorded(d)
        attachment.mutate({ documentId: d.id, image: invoice })
      } else {
        openSaved(d.id)
      }
    },
    onError: (e) => { setError(e); document.querySelector<HTMLElement>('[role="alert"]')?.focus() },
  })
  const canSave = valid && isCurrentPreview && !!preview.data && !preview.isFetching && !preview.isError
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!mutation.isPending && canSave) mutation.mutate(false) }
  useEffect(() => { if (error) { const line = error instanceof ApiError ? error.problem.detail?.split(':')[1] : undefined; const target = document.querySelector<HTMLElement>(line ? `#stock-line-${Number(line)} input` : '[role="alert"]'); target?.focus(); target?.scrollIntoView?.({ block: 'center' }) } }, [error])
  const fmt = (v: string | null | undefined) => decimal(v, i18n.language.startsWith('en'))
  if (recorded) return <div className="catalog-page stock-editor">
    <header className="catalog-page-header"><h1>{recorded.code}</h1></header>
    <Surface className="operations-catalog operations-form">
      <h2>{t('invoice.title')}</h2>
      <p role="status">{t(recorded.status === 'DRAFT' ? 'draftSaved' : 'saved')}</p>
      {attachment.isPending && <p role="status">{t('invoice.uploading')}</p>}
      {attachment.isError && <p role="alert">{invoiceError(attachment.error)}</p>}
      <div className="stock-header-actions">
        {invoice && attachment.isError && invoicePermission.upload && <Button type="button"
          onClick={() => attachment.mutate({ documentId: recorded.id, image: invoice })}>{t('retry')}</Button>}
        <Button type="button" variant="secondary" disabled={attachment.isPending}
          onClick={() => openSaved(recorded.id)}>{t('invoice.continue')}</Button>
      </div>
    </Surface>
    <UnsavedBranchDialog dirty={dirty} busy={attachment.isPending} />
    <ConfirmDialog open={blocker.state === 'blocked'} pending={attachment.isPending}
      onClose={() => blocker.state === 'blocked' && blocker.reset()}
      onConfirm={() => blocker.state === 'blocked' && blocker.proceed()}
      title={t('common:unsavedTitle')} body={t('common:unsavedBody')} confirmLabel={t('common:leave')} />
  </div>
  return <div className="catalog-page stock-editor"><header className="catalog-page-header"><ButtonLink variant="ghost" to={saved ? `/inventory/documents/${saved.id}` : `/inventory/${Object.keys(kinds).find((k) => kinds[k] === values.kind)}`}>{t('back')}</ButtonLink><h1>{saved ? `${t('edit')} · ${saved.code}` : `${t('create')} · ${t(`kind.${values.kind}`)}`}</h1><p>{t('saveHint')}</p></header>
    <form id="stock-editor" className="stock-editor-layout" onSubmit={submit}>
      <div className="stock-editor-sections"><Surface className="operations-catalog"><h2>{t('warehouse')}</h2><div className="operations-form">
        <Lookup label={t('warehouse')} path="warehouses" permission={P.INVENTORY_WAREHOUSE_READ} branchId={branchId} value={values.warehouseId} onChange={(n) => change({ ...values, warehouseId: n, lines: values.lines.map((l) => ({ ...l, balanceVersion: null })) })} required disabled={mutation.isPending} />
        {values.kind === 'RECEIPT' && <Lookup label={t('supplier')} path="suppliers" permission={P.INVENTORY_SUPPLIER_READ} branchId={branchId} value={values.supplierId} onChange={(n) => change({ ...values, supplierId: n })} disabled={mutation.isPending} />}
        <Field label={t('date')}><input type="datetime-local" value={toLocal(values.businessAt)} required disabled={mutation.isPending} onChange={(e) => { if (e.target.value) change({ ...values, businessAt: new Date(e.target.value).toISOString() }) }} /></Field>
        {values.kind === 'ISSUE' && <Field label={t('issueType')}><select value={values.issueType} disabled={mutation.isPending} onChange={(e) => change({ ...values, issueType: e.target.value })}>{['LAUNDRY', 'PACKAGING', 'CONSUMPTION', 'DAMAGED', 'SUPPLIER_RETURN', 'OTHER'].map((v) => <option key={v} value={v}>{t(`issue.${v}`)}</option>)}</select></Field>}
        {values.kind === 'TRANSFER' && <><Field label={t('destinationBranch')}><select value={values.destinationBranchId ?? ''} disabled={mutation.isPending || !!saved} onChange={(e) => change({ ...values, destinationBranchId: Number(e.target.value), destinationWarehouseId: null, lines: values.lines.map((l) => ({ ...l, destinationItemId: null })) })}>{user?.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field><Lookup label={t('destinationWarehouse')} path="warehouses" permission={P.INVENTORY_WAREHOUSE_READ} branchId={values.destinationBranchId!} value={values.destinationWarehouseId} onChange={(n) => change({ ...values, destinationWarehouseId: n })} disabled={mutation.isPending} required /><p>{t('crossBranchHelp')}</p></>}
      </div></Surface>
        <Surface className="operations-catalog"><h2>{t('lines')}</h2>{values.kind === 'STOCKTAKE' && <p>{t('snapshotHelp')}</p>}
          {values.lines.map((line, index) => <LineEditor key={index} line={line} index={index} values={values} captureVersion={captureVersion} serverError={error ?? preview.error} disabled={mutation.isPending} update={(l) => change({ ...values, lines: values.lines.map((old, i) => i === index ? l : old) })} remove={() => change({ ...values, lines: values.lines.filter((_, i) => i !== index) })} />)}
          <Button type="button" variant="secondary" disabled={mutation.isPending || values.lines.length >= 100} onClick={() => change({ ...values, lines: [...values.lines, emptyLine()] })}>{t('addLine')}</Button>
        </Surface>
        <Surface className="operations-catalog"><div className="operations-form">{values.kind === 'RECEIPT' && <StockMoneyInput label={t('charges')} value={values.charges} onValueChange={(v) => change({ ...values, charges: v })} disabled={mutation.isPending} />}<Field label={t('reason')} required={values.kind === 'ADJUSTMENT' || values.kind === 'STOCKTAKE'}><textarea required={values.kind === 'ADJUSTMENT' || values.kind === 'STOCKTAKE'} value={values.reason ?? ''} maxLength={1000} disabled={mutation.isPending} onChange={(e) => change({ ...values, reason: e.target.value })} /></Field><Field label={t('note')}><textarea value={values.note ?? ''} maxLength={1000} disabled={mutation.isPending} onChange={(e) => change({ ...values, note: e.target.value })} /></Field></div></Surface>
      {values.kind === 'RECEIPT' && saved && <ReceiptInvoiceImages documentId={saved.id} branchId={branchId}
        cancelled={saved.status === 'CANCELLED'} manage={false} />}
      {values.kind === 'RECEIPT' && invoicePermission.upload && saved?.status !== 'CANCELLED' &&
        <Surface className="operations-catalog">
          <InvoiceCapture value={invoice?.file ?? null} disabled={mutation.isPending}
            onChange={(file) => setInvoice(file ? { file, command: crypto.randomUUID() } : null)} />
        </Surface>}
      </div>
      <Surface className="operations-catalog stock-summary"><h2>{t('preview')}</h2><p>{t('previewHelp')}</p>{preview.isFetching && <p role="status">{t('previewUpdating')}</p>}{preview.isError && <Failure error={preview.error} retry={() => void preview.refetch()} />}
        {valid && preview.data && <><strong>{t('total')}: {fmt(preview.data.totalValue)}</strong>{values.kind === 'RECEIPT' && <dl className="stock-values">{(['subtotal', 'discountTotal', 'taxTotal'] as const).map((key) => <div key={key}><dt>{t(key)}</dt><dd>{fmt(preview.data?.[key])}</dd></div>)}</dl>}{Object.entries(preview.data.quantities).map(([unit, n]) => <p key={unit}>{fmt(n)} {unit}</p>)}{preview.data.lines.map((l, i) => <p key={i}>{l.itemName}: {fmt(l.baseQuantity)} {l.baseUnit}{l.difference !== undefined ? ` · ${t('difference')}: ${fmt(l.difference)}` : ''} · {t('value')}: {fmt(l.lineValue)}</p>)}</>}
        {!!error && <div role="alert" tabIndex={-1}><Failure error={error} retry={error instanceof ApiError && error.status === 409 ? () => void client.invalidateQueries({ queryKey: ['stock'] }) : undefined} /></div>}
        <p>{t('noFinance')}</p>{saved && <p>{t('dependencyHelp')}</p>}

      </Surface>
    </form>
    <div className="sticky-action-bar"><Button type="submit" form="stock-editor" loading={mutation.isPending} disabled={!canSave}>{t('save')}</Button>{(!saved || saved.status === 'DRAFT') && <Button type="button" variant="secondary" disabled={mutation.isPending || !valid || !isCurrentPreview} onClick={() => { if ((document.getElementById('stock-editor') as HTMLFormElement).reportValidity()) mutation.mutate(true) }}>{t('draft')}</Button>}</div>
    <UnsavedBranchDialog dirty={dirty} busy={mutation.isPending} /><ConfirmDialog open={blocker.state === 'blocked'} onClose={() => blocker.state === 'blocked' && blocker.reset()} onConfirm={() => blocker.state === 'blocked' && blocker.proceed()} title={t('common:unsavedTitle')} body={t('common:unsavedBody')} confirmLabel={t('common:leave')} />
  </div>
}
function LineEditor({ line, index, values, update, remove, disabled, serverError, captureVersion }: { line: Line; index: number; values: Input; update: (l: Line) => void; remove: () => void; disabled: boolean; serverError: unknown; captureVersion: (index: number, warehouseId: number | null, itemId: number | null, version: number, replace: boolean) => void }) {
  const { t, i18n } = useTranslation('stock'); const { hasPermission } = useAuth(); const fmt = (v: string | null | undefined) => decimal(v, i18n.language.startsWith('en'))
  const item = useQuery({ queryKey: ['stock', 'item', values.branchId, line.itemId], queryFn: () => operationsApi.get('/inventory/items', values.branchId, line.itemId!), enabled: !!line.itemId && hasPermission(P.INVENTORY_ITEM_READ) })
  const conversions = useQuery({ queryKey: ['stock', 'conversions', values.branchId, line.itemId], queryFn: () => stockApi.packages(values.branchId, line.itemId!), enabled: !!line.itemId && hasPermission(P.INVENTORY_UNIT_READ) })
  const balance = useQuery({ queryKey: ['stock', 'line-balance', values.branchId, values.warehouseId, line.itemId], queryFn: () => stockApi.balances(query(values.branchId, { ...emptyFilters, warehouseId: String(values.warehouseId), itemId: String(line.itemId) }, 0)), enabled: !!values.warehouseId && !!line.itemId && hasPermission(P.INVENTORY_STOCK_READ) })
  const lots = useQuery({ queryKey: ['stock', 'lots', values.branchId, values.warehouseId, line.itemId], queryFn: () => stockApi.lots(values.branchId, values.warehouseId!, line.itemId!), enabled: !!values.warehouseId && !!line.itemId && !!item.data?.trackLots && hasPermission(P.INVENTORY_STOCK_READ) })
  const current = balance.data?.items[0]
  const invalidFields = serverError instanceof ApiError ? Object.keys(serverError.problem.fieldErrors ?? {}).filter((key) => key.startsWith(`lines[${index}].`)).map((key) => t(({ itemId: 'item', conversionId: 'inputUnit', quantity: 'quantity', unitPrice: 'price', discount: 'discount', tax: 'tax', lotCode: 'lot', expiryDate: 'expiry', destinationItemId: 'destinationItem', increase: 'direction', balanceVersion: 'expected' } as Record<string, string>)[key.split('.').at(-1)!] ?? 'invalid')) : []
  useEffect(() => {
    if (values.kind === 'STOCKTAKE' && line.balanceVersion == null && current &&
        balance.isFetchedAfterMount && balance.isSuccess && !balance.isFetching) {
      captureVersion(index, values.warehouseId, line.itemId, current.version, false)
    }
  }, [current, balance.isFetchedAfterMount, balance.isSuccess, balance.isFetching, values.kind, values.warehouseId, line.balanceVersion, line.itemId, index, captureVersion])
  const numeric = (label: string, key: keyof Line, required = false) => <Field label={label} required={required}><input type="text" inputMode="decimal" pattern="[0-9]+([,.][0-9]{1,6})?" required={required} value={String(line[key] ?? '')} disabled={disabled} onChange={(e) => update({ ...line, [key]: e.target.value })} /></Field>
  return <fieldset className="stock-line" id={`stock-line-${index + 1}`}><legend>{t('item')} {index + 1}</legend><div className="stock-line-fields">
    <Lookup label={`${t('item')} ${index + 1}`} path="items" permission={P.INVENTORY_ITEM_READ} branchId={values.branchId} value={line.itemId} required disabled={disabled} onChange={(n) => update({ ...emptyLine(), itemId: n })} />
    {current && <p>{t('available')}: <strong>{fmt(current.quantity)} {current.baseUnit}</strong> · {t('averageCost')}: {fmt(current.averageCost)}</p>}
    {balance.isError && <Failure error={balance.error} retry={() => void balance.refetch()} />}
    {conversions.isError && <Failure error={conversions.error} retry={() => void conversions.refetch()} />}
    <Field label={t('inputUnit')}><select value={line.conversionId ?? ''} disabled={disabled || values.kind === 'STOCKTAKE'} onChange={(e) => update({ ...line, conversionId: e.target.value ? Number(e.target.value) : null })}><option value="">{t('baseUnit')}</option>{conversions.data?.map((c) => <option key={c.id} value={c.id}>{c.name} · ×{String(c.factor)}</option>)}</select></Field>
    {numeric(t(values.kind === 'STOCKTAKE' ? 'counted' : 'quantity'), 'quantity', true)}
    {(values.kind === 'RECEIPT' || values.kind === 'ADJUSTMENT' || values.kind === 'STOCKTAKE') && <StockMoneyInput label={t('price')} value={line.unitPrice ?? ''} onValueChange={(v) => update({ ...line, unitPrice: v })} required={values.kind === 'RECEIPT'} disabled={disabled} />}
    {values.kind === 'RECEIPT' && <><StockMoneyInput label={t('discount')} value={line.discount} onValueChange={(v) => update({ ...line, discount: v })} disabled={disabled} /><StockMoneyInput label={t('tax')} value={line.tax} onValueChange={(v) => update({ ...line, tax: v })} disabled={disabled} /></>}
    {item.data?.trackLots && <>{lots.data && values.kind !== 'RECEIPT' && <Field label={t('useLot')}><select value={line.lotCode ?? ''} disabled={disabled} onChange={(e) => { const lot = lots.data.find((l) => l.lotCode === e.target.value); if (lot) update({ ...line, lotCode: lot.lotCode, expiryDate: lot.expiryDate }) }}><option value="">{t('select')}</option>{lots.data.map((l) => <option key={l.lotCode} value={l.lotCode}>{l.lotCode} · {fmt(l.quantity)}</option>)}</select></Field>}<Field label={t('lot')} required><input value={line.lotCode ?? ''} disabled={disabled} maxLength={80} required onChange={(e) => update({ ...line, lotCode: e.target.value })} /></Field></>}
    {item.data?.trackExpiry && <DatePickerField label={t('expiry')} value={line.expiryDate ?? ''} disabled={disabled} onChange={(v) => update({ ...line, expiryDate: v })} required />}
    {values.kind === 'ADJUSTMENT' && <Field label={t('direction')}><select disabled={disabled} value={line.increase} onChange={(e) => update({ ...line, increase: Number(e.target.value) })}><option value={1}>{t('increase')}</option><option value={0}>{t('decrease')}</option></select></Field>}
    {values.kind === 'TRANSFER' && values.destinationBranchId !== values.branchId && <Lookup label={t('destinationItem')} path="items" permission={P.INVENTORY_ITEM_READ} branchId={values.destinationBranchId!} value={line.destinationItemId} onChange={(n) => update({ ...line, destinationItemId: n })} disabled={disabled} required />}
    {values.kind === 'STOCKTAKE' && <Button type="button" variant="secondary" disabled={disabled || !values.warehouseId || !line.itemId || balance.isFetching} onClick={async () => { const result = await balance.refetch(); const latest = result.data?.items[0]; if (result.isSuccess && latest) captureVersion(index, values.warehouseId, line.itemId, latest.version, true) }}>{t('reload')}</Button>}
  </div>{(invalidFields.length > 0 || serverError instanceof ApiError && serverError.problem.detail?.split(':')[1] === String(index + 1)) && <p className="form-field__error" role="alert">{invalidFields.length ? t('fieldValidation', { fields: invalidFields.join(', ') }) : stockError(serverError, t)}</p>}<Button type="button" variant="danger" disabled={disabled || values.lines.length === 1} onClick={remove}>{t('removeLine')}</Button></fieldset>
}

export function StockDetailPage() {
  const { documentId } = useParams(); const { branchId } = useAuth(); const { t } = useTranslation('stock')
  const detail = useQuery({ queryKey: ['stock', 'detail', documentId, branchId], queryFn: () => stockApi.detail(Number(documentId), branchId!), enabled: !!branchId, retry: false })
  return <div className="catalog-page operations-workspace"><StockNavigation />{detail.isPending ? <LoadingState /> : detail.isError ? <Failure error={detail.error} retry={() => void detail.refetch()} /> : <Detail data={detail.data} branchId={branchId!} />}{!branchId && <p>{t('error')}</p>}</div>
}
function Detail({ data, branchId }: { data: Document; branchId: number }) {
  const { t, i18n } = useTranslation('stock'); const { hasPermission } = useAuth(); const { notify } = useToast(); const client = useQueryClient(); const fmt = (v: string | number | null) => decimal(v, i18n.language.startsWith('en'))
  const [action, setAction] = useState<'cancel' | 'receive' | 'return' | null>(null); const [reason, setReason] = useState(''); const [quantities, setQuantities] = useState<Record<number, string>>({}); const [page, setPage] = useState(0); const [showHistory, setShowHistory] = useState(false); const [key, setKey] = useState(crypto.randomUUID())
  const history = useQuery({ queryKey: ['stock', 'history', data.id, data.version, page, branchId], queryFn: () => stockApi.history(data.id, branchId, page), enabled: showHistory && hasPermission(P.INVENTORY_AUDIT_READ), retry: false })
  const mutation = useMutation({ mutationFn: () => action === 'cancel' ? stockApi.cancel(data.id, branchId, data.version, reason, key) : stockApi.settle(data.id, branchId, data.version, reason, Object.entries(quantities).filter(([, q]) => q && q !== '0').map(([lineNumber, quantity]) => ({ lineNumber: Number(lineNumber), quantity: quantity.replace(',', '.') })), action === 'return', key), onSuccess: () => { setAction(null); void client.invalidateQueries({ queryKey: ['stock'] }); notify(t(action === 'cancel' ? 'cancelled' : 'saved')) } })
  const start = (a: typeof action) => { setAction(a); setReason(''); setQuantities({}); setKey(crypto.randomUUID()); mutation.reset() }
  const [discard, setDiscard] = useState(false)
  const actionDirty = action !== null && (!!reason || Object.values(quantities).some(Boolean))
  const routeBlocker = useBlocker(actionDirty || mutation.isPending)
  useBeforeUnload((e) => { if (actionDirty || mutation.isPending) { e.preventDefault(); e.returnValue = '' } })
  const close = () => { if (!mutation.isPending) { if (actionDirty) setDiscard(true); else setAction(null) } }
  return <><header className="catalog-page-header"><h1>{data.code}</h1><p>{t(`kind.${data.kind}`)} · {t(`status.${data.status}`)} · {t('revision')} {data.version}</p><DateTimeText value={data.businessAt} /><div className="stock-header-actions">{data.status !== 'CANCELLED' && hasPermission(P.INVENTORY_DOCUMENT_UPDATE) && <ButtonLink to={`/inventory/documents/${data.id}/edit`}>{t('edit')}</ButtonLink>}{data.status !== 'CANCELLED' && hasPermission(P.INVENTORY_DOCUMENT_CANCEL) && <Button variant="danger" onClick={() => start('cancel')}>{t('cancel')}</Button>}{['IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(data.status) && hasPermission(P.INVENTORY_TRANSFER_RECEIVE) && <><Button onClick={() => start('receive')}>{t('receive')}</Button><Button variant="secondary" onClick={() => start('return')}>{t('returnTransit')}</Button></>}{hasPermission(P.INVENTORY_AUDIT_READ) && <Button variant="secondary" onClick={() => setShowHistory(!showHistory)}>{t('history')}</Button>}</div></header>
    <Surface className="operations-catalog"><h2>{data.warehouseName}</h2><p>{data.supplierName}</p><strong>{t('total')}: {fmt(data.totalValue)}</strong><p>{t('actor')}: {data.createdBy} · {t('recordedAt')}: <DateTimeText value={data.updatedAt} /></p><p>{data.input.note}</p>{data.lines.map((l, i) => <article className="operations-record" key={i}><strong>{l.itemName}</strong><p>{fmt(l.quantity)} {l.inputUnit} → {fmt(l.baseQuantity)} {l.baseUnit} · {t('value')}: {fmt(l.lineValue)}</p>{l.lotCode && <p>{l.lotCode} · {l.expiryDate?.split('-').reverse().join('/')}</p>}</article>)}<p>{t('noFinance')}</p></Surface>
    {data.kind === 'RECEIPT' && <ReceiptInvoiceImages key={`${branchId}/${data.id}`} documentId={data.id}
      branchId={branchId} cancelled={data.status === 'CANCELLED'} />}
    {!!data.transit?.length && <Surface className="operations-catalog"><h2>{t('transit')}</h2>{data.transit.map((l) => <p key={l.lineNumber}>{data.lines[l.lineNumber - 1]?.itemName}: {t('quantity')} {fmt(l.dispatched)} · {t('received')} {fmt(l.received)} · {t('returned')} {fmt(l.returned)}</p>)}</Surface>}
    {showHistory && (history.isPending ? <LoadingState /> : history.isError ? <Failure error={history.error} retry={() => void history.refetch()} /> : history.data && <Surface className="operations-catalog"><h2>{t('history')}</h2>{history.data.items.map((r) => <article className="operations-record" key={r.id}><strong>{t('revision')} {r.revision} · {t('actor')} {r.actorId}</strong><DateTimeText value={r.recordedAt} /><p>{r.reason}</p><p>{t('historyBefore')}: {fmt(r.beforeSnapshot?.totalValue ?? null)} · {t('historyAfter')}: {fmt(r.snapshot.totalValue)}</p>{r.effects.map((e, i) => <p key={i}>{t(`phase.${e.phase}`)} · {t('item')} {e.itemId ?? ''}: {fmt(e.quantityDelta)} · {fmt(e.valueDelta)}</p>)}</article>)}<Pagination page={page} pages={history.data.totalPages} count={history.data.totalElements} onPage={setPage} /></Surface>)}
    <OverlayDialog open={action !== null && !discard && routeBlocker.state !== 'blocked'} onClose={close} title={t(action === 'cancel' ? 'cancel' : action === 'return' ? 'returnTransit' : 'receive')} footer={<><Button variant="secondary" disabled={mutation.isPending} onClick={close}>{t('close')}</Button><Button type="submit" form="stock-action" loading={mutation.isPending} variant={action === 'cancel' ? 'danger' : 'primary'}>{t(action === 'cancel' ? 'confirmCancel' : 'settle')}</Button></>}>
      <form id="stock-action" className="operations-form" onSubmit={(e) => { e.preventDefault(); if (!mutation.isPending) mutation.mutate() }}><p>{t(action === 'cancel' ? 'cancelBody' : 'settlementHelp')}</p><Field label={t('reason')} required><textarea required value={reason} maxLength={1000} disabled={mutation.isPending} onChange={(e) => { setReason(e.target.value); setKey(crypto.randomUUID()) }} /></Field>{action !== 'cancel' && data.transit?.map((l) => <Field key={l.lineNumber} label={data.lines[l.lineNumber - 1]?.itemName ?? t('quantity')}><input inputMode="decimal" value={quantities[l.lineNumber] ?? ''} disabled={mutation.isPending} onChange={(e) => { setQuantities({ ...quantities, [l.lineNumber]: e.target.value }); setKey(crypto.randomUUID()) }} /></Field>)}{mutation.isError && <Failure error={mutation.error} />}</form>
    </OverlayDialog>
    <UnsavedBranchDialog dirty={actionDirty} busy={mutation.isPending} />
    <ConfirmDialog open={discard || routeBlocker.state === 'blocked'} pending={mutation.isPending} onClose={() => { setDiscard(false); if (routeBlocker.state === 'blocked') routeBlocker.reset() }} onConfirm={() => { setAction(null); setDiscard(false); if (routeBlocker.state === 'blocked') routeBlocker.proceed() }} title={t('common:unsavedTitle')} body={t('common:unsavedBody')} confirmLabel={t('common:leave')} />
  </>
}
