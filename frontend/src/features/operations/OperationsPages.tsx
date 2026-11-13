import { stockPages } from '../stock/types'
import { StockNavigation } from '../stock/StockNavigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useBeforeUnload, useBlocker, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES as P } from '../../auth/permissionCodes.generated'
import { Field } from '../../components/Field'
import { UnsavedBranchDialog } from '../../components/UnsavedBranchDialog'
import { MoneyInput } from '../../components/MoneyInput'
import { AppNavLink } from '../../components/navigation/AppNavLink'
import { ConfirmDialog, OverlayDialog } from '../../components/OverlayDialog'
import { ErrorState, LoadingState, PermissionDeniedState, StatePanel } from '../../components/States'
import { Button } from '../../components/ui/Button'
import { DateTimeText } from '../../components/ui/DateTimeText'
import { Surface } from '../../components/ui/Surface'
import { useDebouncedValue } from '../../components/operational-list/useDebouncedValue'
import { useToast } from '../../providers/ToastProvider'
import { operationsApi } from './api'
import { catalogs, type CatalogDefinition, type CatalogRecord, type FieldDefinition, type Module, type Policy, type Values } from './catalog'

function QueryError({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useTranslation('operations')
  return error instanceof ApiError && error.status === 403 ? <PermissionDeniedState /> : <ErrorState title={t('error')} body={t('errorBody')} onRetry={retry} />
}

function Pager({ page, pages, count, onPage }: { page: number; pages: number; count: number; onPage: (page: number) => void }) {
  const { t } = useTranslation('operations')
  return <nav className="operations-pagination" aria-label={t('navigation')}>
    <span>{t('page', { page: page + 1, count })}</span>
    <Button variant="secondary" disabled={page === 0} onClick={() => onPage(page - 1)}>{t('previous')}</Button>
    <Button variant="secondary" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>{t('next')}</Button>
  </nav>
}

export function OperationsPage({ module }: { module: Module }) {
  const { resource } = useParams()
  const { branchId, hasPermission } = useAuth()
  const { t } = useTranslation('operations')
  const visible = catalogs[module].filter((c) => hasPermission(c.read))
  const settingsRead = module === 'inventory' ? P.INVENTORY_SETTINGS_READ : P.FINANCE_SETTINGS_READ
  const auditRead = module === 'inventory' ? P.INVENTORY_AUDIT_READ : P.FINANCE_AUDIT_READ
  const first = visible[0]?.key ?? (hasPermission(settingsRead) ? 'settings' : hasPermission(auditRead) ? 'history' : null)
  const stockDestination = module === 'inventory' ? stockPages.find((p) => hasPermission(p.permission)) : undefined
  if (!resource && stockDestination) return <Navigate to={`/inventory/${stockDestination.path}`} replace />
  if (!resource) return first ? <Navigate to={`/${module}/${first}`} replace /> : <PermissionDeniedState />
  const definition = visible.find((c) => c.key === resource)
  const allowed = definition || (resource === 'settings' && hasPermission(settingsRead)) || (resource === 'history' && hasPermission(auditRead))
  return <div className="catalog-page operations-workspace">
    <header className="catalog-page-header"><div><h1>{t(module)}</h1><p>{t('subtitle')}</p></div></header>
    <Surface as="nav" variant="subtle" className="catalog-module-tabs operations-tabs" aria-label={t('navigation')}>
      {visible.map((c) => <AppNavLink key={c.key} to={`/${module}/${c.key}`} className="catalog-module-tab" activeClassName="catalog-module-tab--active" indicatorId={`operations-${module}`}>{t(`resources.${c.key}`)}</AppNavLink>)}
      {hasPermission(settingsRead) && <AppNavLink to={`/${module}/settings`} className="catalog-module-tab" activeClassName="catalog-module-tab--active" indicatorId={`operations-${module}`}>{t('resources.settings')}</AppNavLink>}
      {hasPermission(auditRead) && <AppNavLink to={`/${module}/history`} className="catalog-module-tab" activeClassName="catalog-module-tab--active" indicatorId={`operations-${module}`}>{t('resources.history')}</AppNavLink>}
    </Surface>
    {module === 'inventory' ? <StockNavigation /> : <p className="operations-notice">{t('foundationBody')}</p>}
    {!allowed ? <PermissionDeniedState /> : !branchId ? <StatePanel title={t('noBranch')} body={t('subtitle')} /> :
      resource === 'settings' ? <PolicyPage key={`${module}/${branchId}`} module={module} branchId={branchId} /> :
        resource === 'history' ? <HistoryPage key={`${module}/${branchId}`} module={module} branchId={branchId} /> :
          definition ? <CatalogPage key={`${module}/${resource}/${branchId}`} module={module} definition={definition} branchId={branchId} /> : null}
  </div>
}

function CatalogPage({ module, definition, branchId }: { module: Module; definition: CatalogDefinition; branchId: number }) {
  const { hasPermission } = useAuth()
  const { t } = useTranslation('operations')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<CatalogRecord | 'new' | null>(null)
  const path = `/${module}/${definition.key}`
  const query = useQuery({ queryKey: ['operations', path, branchId, page, debouncedSearch, status], queryFn: () => operationsApi.list(path, branchId, page, debouncedSearch, status ? status === 'active' : undefined) })
  const manage = hasPermission(definition.manage)
  return <>
    <Surface className="operations-catalog">
      <header className="operations-section-header"><h2>{t(`resources.${definition.key}`)}</h2>{manage && <Button onClick={() => setEditing('new')}>{t('create')}</Button>}</header>
      <div className="operations-filters">
        <Field label={t('search')}><input type="search" value={search} maxLength={150} onChange={(e) => { setSearch(e.target.value); setPage(0) }} /></Field>
        <Field label={t('filter')}><select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}><option value="">{t('all')}</option><option value="active">{t('active')}</option><option value="inactive">{t('inactive')}</option></select></Field>
      </div>
      {query.isPending ? <LoadingState /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : !query.data.items.length ? <StatePanel title={t(search || status ? 'noResults' : 'empty')} body={t('emptyBody')} /> : <>
        <div className="operations-mobile-records">{query.data.items.map((r) => <article key={r.id} className="operations-record"><strong>{r.name}</strong><span className="operations-secondary">{r.code}</span><span>{t(r.active ? 'active' : 'inactive')}</span><Button variant="secondary" onClick={() => setEditing(r)}>{t(manage ? 'edit' : 'detail')}</Button></article>)}</div>
        <div className="operations-desktop-table"><table><thead><tr><th>{t('fields.name')}</th><th>{t('code')}</th><th>{t('status')}</th><th>{t('actions')}</th></tr></thead><tbody>{query.data.items.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.code}</td><td>{t(r.active ? 'active' : 'inactive')}</td><td><Button variant="secondary" onClick={() => setEditing(r)}>{t(manage ? 'edit' : 'detail')}</Button></td></tr>)}</tbody></table></div>
      </>}
      {query.data && <Pager page={page} pages={query.data.totalPages} count={query.data.totalElements} onPage={setPage} />}
    </Surface>
    {editing && <CatalogEditor key={editing === 'new' ? 'new' : editing.id} branchId={branchId} path={path} definition={definition} record={editing === 'new' ? undefined : editing} editable={manage} onClose={() => setEditing(null)} />}
  </>
}

export function ReferenceField({ field, value, onChange, branchId, disabled, label }: { field: FieldDefinition; value: string; onChange: (value: string) => void; branchId: number; disabled: boolean; label?: string }) {
  const { hasPermission } = useAuth()
  const { t } = useTranslation('operations')
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 250)
  const [page, setPage] = useState(0)
  const allowed = !!field.reference && !!field.readPermission && hasPermission(field.readPermission)
  const query = useQuery({ queryKey: ['operations', 'reference', field.reference, branchId, page, debounced], queryFn: () => operationsApi.list(field.reference!, branchId, page, debounced, true), enabled: allowed && !disabled })
  const selected = useQuery({ queryKey: ['operations', 'reference-detail', field.reference, branchId, value], queryFn: () => operationsApi.get(field.reference!, branchId, Number(value)), enabled: allowed && !!value })
  const options = query.data?.items ?? []
  return <div className="operations-reference">
    {!allowed ? <p>{t('referenceDenied')}</p> : <>
      {!disabled && <input type="search" aria-label={`${t('lookup')}: ${label ?? t(`fields.${field.key}`)}`} placeholder={t('lookup')} value={search} maxLength={150} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />}
      <select aria-label={label ?? t(`fields.${field.key}`)} required={field.required} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">{t(field.required ? 'select' : 'none')}</option>
        {value && !options.some((o) => String(o.id) === value) && <option value={value}>{selected.data?.name ?? t('common:loading')}</option>}
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      {(query.isError || selected.isError) && <QueryError error={query.error ?? selected.error} retry={() => { void query.refetch(); if (value) void selected.refetch() }} />}
      {!disabled && query.isFetching && <span role="status">{t('common:loading')}</span>}
      {!disabled && query.data && query.data.totalPages > 1 && <Pager page={page} pages={query.data.totalPages} count={query.data.totalElements} onPage={setPage} />}
    </>}
  </div>
}

function initialValues(fields: FieldDefinition[], record?: CatalogRecord): Values {
  const values: Values = { name: record?.name ?? '', note: record?.note ?? '', active: record?.active ?? true }
  for (const field of fields) values[field.key] = field.kind === 'boolean' ? Boolean(record?.[field.key]) : String(record?.[field.key] ?? (field.key === 'minimumStock' ? '0' : ''))
  return values
}

function decimalText(value: string | boolean) { return String(value).trim().replace(',', '.') }

function CatalogEditor({ branchId, path, definition, record, editable, onClose }: { branchId: number; path: string; definition: CatalogDefinition; record?: CatalogRecord; editable: boolean; onClose: () => void }) {
  const { hasPermission } = useAuth()
  const { t } = useTranslation('operations')
  const client = useQueryClient()
  const toast = useToast()
  const [initial] = useState(() => initialValues(definition.fields, record))
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [discard, setDiscard] = useState(false)
  const [message, setMessage] = useState('')
  const dirty = JSON.stringify(initial) !== JSON.stringify(values)
  const blocker = useBlocker(dirty)
  useBeforeUnload((event) => { if (dirty) { event.preventDefault(); event.returnValue = '' } })
  const mutation = useMutation({ mutationFn: (body: Record<string, unknown>) => operationsApi.save(path, body, record?.id), onSuccess: () => { void client.invalidateQueries({ queryKey: ['operations'] }); toast.notify(t('saved')); onClose() }, onError: (error) => {
    if (error instanceof ApiError && error.problem.fieldErrors) setErrors(Object.fromEntries(Object.entries(error.problem.fieldErrors).map(([k, messages]) => [k, t(messages[0], { defaultValue: t('invalid') })])))
    setMessage(error instanceof ApiError && error.status === 409 ? t(error.problem.errorCode === 'OPERATIONS_VERSION_CONFLICT' ? 'stale' : 'conflict') : error instanceof ApiError && error.status === 422 ? t('invalid') : t('errorBody'))
  } })
  const change = (key: string, value: string | boolean) => { setValues((v) => ({ ...v, [key]: value })); setErrors((e) => ({ ...e, [key]: '' })) }
  const close = () => { if (!mutation.isPending) { if (dirty) setDiscard(true); else onClose() } }
  const denied = mutation.error instanceof ApiError && mutation.error.status === 403
  const fields: FieldDefinition[] = [{ key: 'name', required: true, max: 150 }, ...definition.fields, { key: 'note', kind: 'textarea', max: 1000 }, { key: 'active', kind: 'boolean' }]
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (mutation.isPending || !editable) return
    const validation: Record<string, string> = {}
    for (const f of fields) {
      const value = f.kind === 'decimal' ? decimalText(values[f.key]) : String(values[f.key]).trim()
      if (f.required && !value) validation[f.key] = t('required')
      if (f.kind === 'decimal' && value && !/^\d{1,13}(\.\d{1,6})?$/.test(value)) validation[f.key] = t('decimal')
    }
    if (values.factor && !/[1-9]/.test(String(values.factor))) validation.factor = t('positive')
    if (values.maximumStock && Number(decimalText(values.maximumStock)) < Number(decimalText(values.minimumStock))) validation.maximumStock = t('maxStock')
    if (values.trackExpiry && !values.trackLots) validation.trackExpiry = t('expiry')
    setErrors(validation)
    if (Object.keys(validation).length) { document.getElementById(`operations-${Object.keys(validation)[0]}`)?.focus(); return }
    const body: Record<string, unknown> = { branchId, version: record?.version, name: String(values.name).trim(), active: values.active, note: values.note || null }
    for (const field of definition.fields) {
      const value = values[field.key]
      body[field.key] = field.kind === 'reference' ? value ? Number(value) : null : field.kind === 'boolean' ? value : value === '' ? null : field.kind === 'decimal' ? decimalText(value) : value
    }
    if (!hasPermission(P.INVENTORY_COST_UPDATE)) delete body.referencePrice
    mutation.mutate(body)
  }
  return <>
    <OverlayDialog open onClose={close} title={`${t(editable ? record ? 'edit' : 'create' : 'detail')} · ${t(`resources.${definition.key}`)}`} description={record ? record.code : t('codeHelp')} footer={<><Button variant="secondary" disabled={mutation.isPending} onClick={close}>{t('cancel')}</Button>{editable && <Button type="submit" form="operations-edit" loading={mutation.isPending} disabled={denied}>{t('save')}</Button>}</>}>
      <form id="operations-edit" className="operations-form" onSubmit={submit}>
        {denied ? <PermissionDeniedState /> : message && <p role="alert">{message}</p>}
        {definition.key === 'conversions' && <p>{t('factorHelp')}</p>}
        {definition.key === 'accounts' && <p>{t('accountHelp')}</p>}
        {fields.map((field) => {
          const disabled = !editable || mutation.isPending || (!!record && field.immutable) || (field.key === 'referencePrice' && !hasPermission(P.INVENTORY_COST_UPDATE))
          if (field.key === 'referencePrice' && !hasPermission(P.INVENTORY_COST_READ) && !hasPermission(P.INVENTORY_COST_UPDATE)) return null
          const id = `operations-${field.key}`
          const label = t(`fields.${field.key}`)
          if (field.kind === 'money') return <MoneyInput key={field.key} id={id} label={label} value={String(values[field.key])} onValueChange={(v) => change(field.key, v)} disabled={disabled} error={errors[field.key]} maxIntegerDigits={17} fractionDigits={2} />
          if (field.kind === 'reference') return <div key={field.key} id={id} tabIndex={-1} className="form-field"><span className="form-field__label">{label}{field.required ? ' *' : ''}</span><ReferenceField field={field} value={String(values[field.key])} onChange={(v) => change(field.key, v)} branchId={branchId} disabled={Boolean(disabled)} />{errors[field.key] && <span className="form-field__error" role="alert">{errors[field.key]}</span>}</div>
          const inputProps = { id, disabled: Boolean(disabled), 'aria-invalid': !!errors[field.key], 'aria-describedby': errors[field.key] ? `${id}-error` : undefined }
          return <div key={field.key}><Field label={label} required={field.required} controlId={id} hint={record && field.immutable ? t('immutable') : undefined}>
            {field.kind === 'boolean' ? <input {...inputProps} type="checkbox" checked={Boolean(values[field.key])} onChange={(e) => change(field.key, e.target.checked)} /> :
              field.kind === 'choice' ? <select {...inputProps} value={String(values[field.key])} required={field.required} onChange={(e) => change(field.key, e.target.value)}><option value="">{t('select')}</option>{field.choices?.map((v) => <option key={v} value={v}>{t(`choices.${v}`)}</option>)}</select> :
                field.kind === 'textarea' ? <textarea {...inputProps} value={String(values[field.key])} maxLength={field.max} onChange={(e) => change(field.key, e.target.value)} /> :
                  <input {...inputProps} type={field.kind === 'email' || field.kind === 'tel' ? field.kind : 'text'} inputMode={field.kind === 'decimal' ? 'decimal' : field.kind === 'tel' ? 'tel' : undefined} required={field.required} maxLength={field.max} value={String(values[field.key])} onChange={(e) => change(field.key, e.target.value)} />}
          </Field>{errors[field.key] && <span id={`${id}-error`} className="form-field__error" role="alert">{errors[field.key]}</span>}</div>
        })}
      </form>
    </OverlayDialog>
    <ConfirmDialog open={discard || blocker.state === 'blocked'} onClose={() => { setDiscard(false); if (blocker.state === 'blocked') blocker.reset() }} onConfirm={() => { if (blocker.state === 'blocked') blocker.proceed(); else onClose() }} title={t('common:unsavedTitle')} body={t('common:unsavedBody')} confirmLabel={t('common:leave')} />
    <UnsavedBranchDialog dirty={dirty} busy={mutation.isPending} />
  </>
}

function PolicyPage({ module, branchId }: { module: Module; branchId: number }) {
  const query = useQuery({ queryKey: ['operations', module, 'settings', branchId], queryFn: () => operationsApi.policy(module, branchId) })
  return query.isPending ? <LoadingState /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : <PolicyForm key={query.data.version} module={module} branchId={branchId} initial={query.data} />
}

function PolicyForm({ module, branchId, initial }: { module: Module; branchId: number; initial: Policy }) {
  const { t } = useTranslation('operations')
  const { hasPermission } = useAuth()
  const client = useQueryClient()
  const toast = useToast()
  const [values, setValues] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const manage = hasPermission(module === 'inventory' ? P.INVENTORY_SETTINGS_MANAGE : P.FINANCE_SETTINGS_MANAGE)
  const dirty = JSON.stringify(values) !== JSON.stringify(saved)
  const blocker = useBlocker(dirty)
  useBeforeUnload((e) => { if (dirty) { e.preventDefault(); e.returnValue = '' } })
  const mutation = useMutation({ mutationFn: () => operationsApi.savePolicy(module, { ...values, branchId }), onSuccess: (data) => { setSaved(data); setValues(data); toast.notify(t('saved')); void client.invalidateQueries({ queryKey: ['operations', module, 'settings'] }) } })
  const disabled = !manage || mutation.isPending || (mutation.error instanceof ApiError && mutation.error.status === 403)
  const reference: FieldDefinition = { key: 'defaultResourceId', reference: module === 'inventory' ? '/inventory/warehouses' : '/finance/accounts', readPermission: module === 'inventory' ? P.INVENTORY_WAREHOUSE_READ : P.FINANCE_ACCOUNT_READ }
  return <Surface className="operations-catalog"><h2>{t('resources.settings')}</h2><p>{t('policyHelp')}</p>{module === 'inventory' && <p>{t('valuationHelp')}</p>}
    <form className="operations-form" onSubmit={(e) => { e.preventDefault(); if (manage && !mutation.isPending) mutation.mutate() }}>
      {mutation.isError && <QueryError error={mutation.error} retry={() => void client.invalidateQueries({ queryKey: ['operations', module, 'settings'] })} />}
      <Field label={t(module === 'inventory' ? 'allowNegativeStock' : 'fields.allowNegative')}><input type="checkbox" checked={values.allowNegative} disabled={disabled} onChange={(e) => setValues({ ...values, allowNegative: e.target.checked })} /></Field>
      <div className="form-field"><span className="form-field__label">{t('fields.defaultResourceId')}</span><ReferenceField field={reference} value={String(values.defaultResourceId ?? '')} onChange={(v) => setValues({ ...values, defaultResourceId: v ? Number(v) : null })} branchId={branchId} disabled={disabled} /></div>
      {manage && <Button type="submit" loading={mutation.isPending} disabled={!dirty}>{t('save')}</Button>}
    </form>
    <ConfirmDialog open={blocker.state === 'blocked'} onClose={() => blocker.state === 'blocked' && blocker.reset()} onConfirm={() => blocker.state === 'blocked' && blocker.proceed()} title={t('common:unsavedTitle')} body={t('common:unsavedBody')} confirmLabel={t('common:leave')} />
    <UnsavedBranchDialog dirty={dirty} busy={mutation.isPending} />
  </Surface>
}

function HistoryPage({ module, branchId }: { module: Module; branchId: number }) {
  const { t } = useTranslation('operations')
  const [page, setPage] = useState(0)
  const query = useQuery({ queryKey: ['operations', module, 'history', branchId, page], queryFn: () => operationsApi.history(module, branchId, page) })
  return <Surface className="operations-catalog"><h2>{t('history')}</h2>{query.isPending ? <LoadingState /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : <>
    {!query.data.items.length && <StatePanel title={t('empty')} body={t('emptyBody')} />}
    <div className="operations-history">{query.data.items.map((a) => <article className="operations-record" key={a.id}><strong>{t(a.action)} · {t(`resources.${a.resource}`)}</strong><DateTimeText value={a.occurredAt} /><span>{t('record')}: {a.recordId} · {t('actor')}: {a.actorId}</span><span className="operations-secondary">{t('changes')}: {[...new Set(a.changedFields.split(',').map((f) => t(f === 'approvalRequired' || f === 'approvalThreshold' ? 'legacyConfiguration' : `fields.${f}`)))].join(', ')}</span></article>)}</div>
    <Pager page={page} pages={query.data.totalPages} count={query.data.totalElements} onPage={setPage} />
  </>}</Surface>
}
