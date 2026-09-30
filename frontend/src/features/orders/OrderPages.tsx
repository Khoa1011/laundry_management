import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Clock3, Cog, Layers3, PackageCheck, Pencil, Plus, RefreshCw, RotateCcw, Search, Shirt, ShoppingBag, Timer, Trash2, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { Field } from '../../components/Field'
import { OverlayDialog } from '../../components/OverlayDialog'
import { ErrorState, LoadingState, StatePanel } from '../../components/States'
import { Button, ButtonLink } from '../../components/ui/Button'
import { CollapsibleFilterPanel } from '../../components/ui/CollapsibleFilterPanel'
import { DatePickerField } from '../../components/ui/DatePickerField'
import { Surface } from '../../components/ui/Surface'
import { useToast } from '../../providers/ToastProvider'
import { useRealtime } from '../../realtime/context'
import { QuickCustomerDialog } from '../customers/QuickCustomerDialog'
import type { PricingPreview } from '../service-catalog/types'
import { batchKeys, washBatchApi } from '../wash-batches/api'
import { orderApi, orderKeys } from './api'
import { localDayStartIso, nextLocalDayStartIso } from './dateFilters'
import { promisedDateInstant, promisedDateKey, promisedDateLabel } from '../../utils/promisedDate'
import type { IntakeCustomer, Order, OrderItemNoteUpdate, OrderItemPayload, OrderStatus } from './types'
import { OrderBatchComposer } from './OrderBatchComposer'

const statusText: Record<OrderStatus, string> = {
  RECEIVED: 'Đã nhận', PROCESSING: 'Đang xử lý', READY: 'Sẵn sàng',
  COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', REOPENED: 'Đã mở lại',
}
const money = (value: number, currency = 'VND') => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2,
}).format(value)
const when = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short', timeStyle: 'short',
}).format(new Date(value))
const initials = (value?: string) => (value || 'Khách vãng lai')
  .trim()
  .split(/\s+/)
  .slice(-2)
  .map((part) => part[0]?.toLocaleUpperCase('vi-VN'))
  .join('')
type DueFilter = '' | 'OVERDUE' | 'TODAY' | 'TOMORROW' | 'NEXT_7_DAYS' | 'NO_DATE'
const localDateKey = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
const shiftedLocalDateKey = (days: number) => { const value = new Date(); value.setHours(12, 0, 0, 0); value.setDate(value.getDate() + days); return localDateKey(value) }
function dueFilterParams(value: DueFilter) {
  if (value === 'OVERDUE') return { promisedTo: localDayStartIso(shiftedLocalDateKey(0)), overdueOnly: true }
  if (value === 'TODAY') return { promisedFrom: localDayStartIso(shiftedLocalDateKey(0)), promisedTo: localDayStartIso(shiftedLocalDateKey(1)) }
  if (value === 'TOMORROW') return { promisedFrom: localDayStartIso(shiftedLocalDateKey(1)), promisedTo: localDayStartIso(shiftedLocalDateKey(2)) }
  if (value === 'NEXT_7_DAYS') return { promisedFrom: localDayStartIso(shiftedLocalDateKey(0)), promisedTo: localDayStartIso(shiftedLocalDateKey(7)) }
  if (value === 'NO_DATE') return { promisedMissing: true }
  return {}
}
function Status({ value }: { value: OrderStatus }) {
  return <span className={`order-status order-status--${value.toLowerCase()}`}>{statusText[value]}</span>
}

function StatusFilterIcon({ value }: { value?: OrderStatus }) {
  if (!value) return <ClipboardList size={18} />
  if (value === 'RECEIVED') return <Timer size={18} />
  if (value === 'PROCESSING') return <Cog size={18} />
  if (value === 'READY') return <Clock3 size={18} />
  if (value === 'COMPLETED') return <CheckCircle2 size={18} />
  if (value === 'CANCELLED') return <Ban size={18} />
  return <RotateCcw size={18} />
}

export function OrderListPage() {
  const { branchId, hasPermission } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { subscribe } = useRealtime()
  const [status, setStatus] = useState<OrderStatus>()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [due, setDue] = useState<DueFilter>('')
  const canCreate = hasPermission(PERMISSION_CODES.ORDER_CREATE)
  const canCreateBatch = hasPermission(PERMISSION_CODES.BATCH_CREATE)
  const batchMode = canCreateBatch && location.pathname === '/orders/batching'
  const filterOptions = useQuery({ queryKey: orderKeys.filterOptions(branchId), queryFn: () => orderApi.filterOptions(branchId!), enabled: Boolean(branchId && !batchMode) })
  const query = useQuery({
    queryKey: orderKeys.list(branchId, status, search, page, from, to, serviceId ? Number(serviceId) : undefined, due),
    queryFn: () => orderApi.list({ branchId: branchId!, status, search: search || undefined, page, size: 20,
      from: from ? localDayStartIso(from) : undefined,
      to: to ? nextLocalDayStartIso(to) : undefined,
      serviceId: serviceId ? Number(serviceId) : undefined,
      ...dueFilterParams(due) }),
    enabled: Boolean(branchId && !batchMode),
  })
  useEffect(() => subscribe('order.', () => {
    void queryClient.invalidateQueries({ queryKey: orderKeys.all, refetchType: 'active' })
  }), [queryClient, subscribe])
  useEffect(() => subscribe('realtime.reconnected', () => {
    void queryClient.invalidateQueries({ queryKey: orderKeys.all, refetchType: 'active' })
  }), [queryClient, subscribe])

  const statusCount = (value?: OrderStatus) => {
    if (!query.data) return undefined
    if (status === value) return query.data.totalElements
    if (status === undefined && query.data.totalPages <= 1 && value) {
      return query.data.items.filter((order) => order.status === value).length
    }
    return undefined
  }
  const advancedFilterCount = Number(Boolean(from)) + Number(Boolean(to)) + Number(Boolean(serviceId)) + Number(Boolean(due))
  const hasActiveFilters = Boolean(status || search || advancedFilterCount)

  return <div className="page-container orders-page">
    <header className="orders-heading">
      <div className="orders-heading__copy"><p className="eyebrow">Vận hành tại quầy</p><h1>{batchMode ? 'Ghép mẻ từ đơn hàng' : 'Đơn hàng'}</h1><p>{batchMode ? 'Chọn đồ từ nhiều đơn, kiểm tra tổng khối lượng và yêu cầu trước khi tạo mẻ.' : 'Theo dõi đơn theo trạng thái và cập nhật theo thời gian thực.'}</p></div>
      {!batchMode && <div className="orders-heading__actions">
        {canCreateBatch && <Button variant="secondary" onClick={() => navigate('/orders/batching')}><Layers3 size={18} />Ghép mẻ</Button>}
        {canCreate && <ButtonLink to="/orders/new" variant="primary"><Plus size={18} />Tạo đơn hàng</ButtonLink>}
      </div>}
    </header>
    {batchMode ? <OrderBatchComposer onClose={() => navigate('/orders')} /> : <><div className="order-tabs" role="group" aria-label="Trạng thái đơn hàng">
      {([undefined, 'RECEIVED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED', 'REOPENED'] as const).map((value) => {
        const count = statusCount(value)
        return <button key={value ?? 'all'} type="button" data-status={(value ?? 'all').toLowerCase()} aria-pressed={status === value} className={status === value ? 'active' : ''} onClick={() => { setStatus(value); setPage(0) }}>
          <span className="order-tabs__icon"><StatusFilterIcon value={value} /></span>
          <span>{value ? statusText[value] : 'Tất cả'}</span>
          <span className={`order-tabs__count${count === undefined ? ' order-tabs__count--placeholder' : ''}`} aria-hidden={count === undefined ? true : undefined} aria-label={count === undefined ? undefined : `${count} đơn`}>{count ?? 0}</span>
        </button>
      })}
    </div>
    <Surface className="orders-list-surface">
      <div className="orders-toolbar">
        <label className="order-search"><Search size={18} /><span className="sr-only">Tìm đơn</span>
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Mã đơn, tên khách, số điện thoại, dịch vụ" />
        </label><span className="orders-count" aria-live="polite">{query.isLoading ? 'Đang tải' : `${query.data?.totalElements ?? 0} đơn`}</span>
      </div>
      <div className="orders-filter-row">
        <CollapsibleFilterPanel className="orders-advanced-filters" label="Bộ lọc nâng cao" activeCount={advancedFilterCount} fieldsClassName="orders-date-fields">
          <Field label="Dịch vụ"><select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setPage(0) }}><option value="">Tất cả dịch vụ</option>{filterOptions.data?.services.map((service) => <option key={service.id} value={service.id}>{service.label}</option>)}</select></Field>
          <Field label="Hạn trả"><select value={due} onChange={(event) => { setDue(event.target.value as DueFilter); setPage(0) }}><option value="">Tất cả hạn trả</option><option value="OVERDUE">Đã quá hạn</option><option value="TODAY">Hẹn trả hôm nay</option><option value="TOMORROW">Hẹn trả ngày mai</option><option value="NEXT_7_DAYS">Trong 7 ngày tới</option><option value="NO_DATE">Chưa hẹn trả</option></select></Field>
          <Field label="Từ ngày"><input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(0) }} /></Field>
          <Field label="Đến ngày"><input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(0) }} /></Field>
          {advancedFilterCount > 0 && <Button variant="ghost" type="button" onClick={() => { setFrom(''); setTo(''); setServiceId(''); setDue(''); setPage(0) }}>Xóa lọc</Button>}
        </CollapsibleFilterPanel>
        <img className="orders-filter-slogan" src="/images/orders/orders-slogan.webp" alt="" aria-hidden="true" />
      </div>
      {query.isLoading ? <LoadingState rows={6} /> : query.isError
        ? <ErrorState title="Không tải được đơn hàng" body="Kiểm tra kết nối rồi thử lại." onRetry={() => void query.refetch()} />
        : !query.data?.items.length
          ? <StatePanel className="orders-empty-state" icon={<img className="orders-empty-illustration" src="/images/wash-batches/wash-batches-empty.png" alt="" decoding="async" />} title={hasActiveFilters ? 'Không tìm thấy đơn phù hợp' : 'Chưa có đơn hàng'} body={hasActiveFilters ? 'Thử đổi trạng thái, từ khóa hoặc bộ lọc nâng cao.' : 'Tạo đơn hàng đầu tiên để bắt đầu theo dõi và xử lý.'} action={canCreate ? <ButtonLink to="/orders/new"><Plus size={18} />Tạo đơn hàng</ButtonLink> : undefined} />
          : <>
            <div className="orders-mobile-list">{query.data.items.map((order) =>
              <button className="order-card" key={order.id} onClick={() => navigate(`/orders/${order.id}`)}>
                <div className="order-card__head"><strong>{order.orderCode}</strong><Status value={order.status} /></div>
                <div className="order-card__customer"><span className="order-customer-avatar" aria-hidden="true">{initials(order.customerName)}</span><span><h2>{order.customerName || 'Khách vãng lai'}</h2>{order.customerPhone && <small>{order.customerPhone}</small>}</span></div>
                <p className="order-card__service"><span aria-hidden="true"><Shirt size={17} /></span>{order.serviceSummary || 'Dịch vụ giặt là'}</p>
                <div className="order-card__foot"><span>{when(order.createdAt)}</span><strong>{money(order.totalAmount, order.currency)}</strong><ChevronRight size={18} /></div>
              </button>)}</div>
            <div className="orders-table-wrap"><table className="orders-table"><thead><tr>
              <th>Mã đơn</th><th>Thời gian nhận</th><th>Khách hàng</th><th>Dịch vụ</th><th>Tổng tiền</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th>
            </tr></thead><tbody>{query.data.items.map((order) => <tr key={order.id}>
              <td><Link to={`/orders/${order.id}`}>{order.orderCode}</Link></td><td>{when(order.createdAt)}</td>
              <td><span className="orders-table__customer"><span className="order-customer-avatar" aria-hidden="true">{initials(order.customerName)}</span><span><strong>{order.customerName || 'Khách vãng lai'}</strong><small>{order.customerPhone}</small></span></span></td>
              <td><span className="orders-table__service"><span aria-hidden="true"><Shirt size={17} /></span>{order.serviceSummary || 'Dịch vụ giặt là'}</span></td><td><strong className="orders-table__amount">{money(order.totalAmount, order.currency)}</strong></td><td><Status value={order.status} /></td>
              <td><ButtonLink className="orders-table__view-button" size="sm" variant="ghost" to={`/orders/${order.id}`}>Xem</ButtonLink></td>
            </tr>)}</tbody></table></div>
            {query.data.totalPages > 1 && <nav className="orders-pagination" aria-label="Phân trang đơn hàng">
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={17} />Trước</Button>
              <span>Trang {page + 1} / {query.data.totalPages}</span>
              <Button variant="secondary" size="sm" disabled={page + 1 >= query.data.totalPages} onClick={() => setPage((value) => value + 1)}>Sau<ChevronRight size={17} /></Button>
            </nav>}
          </>}
    </Surface></>}
  </div>
}

type DraftItem = Omit<OrderItemPayload, 'itemTypeId'> & { key: number; itemTypeId?: number }
type PricingDraftItem = Omit<DraftItem, 'note'>

function pricingInputSignature(values: DraftItem[]) {
  return JSON.stringify(values.map(({ key, serviceId, itemTypeId, sharingMode, priorityLevel, quantity }) => ({
    key, serviceId, itemTypeId, sharingMode, priorityLevel, quantity,
  })))
}

function usePricingInputs(values: DraftItem[]) {
  const signature = pricingInputSignature(values)
  return useMemo(() => JSON.parse(signature) as PricingDraftItem[], [signature])
}

const normalizedItemNote = (value?: string) => value?.trim() || null

export function OrderCreatePage() {
  const { branchId, hasPermission } = useAuth()
  const navigate = useNavigate()
  const { notify } = useToast()
  const [mode, setMode] = useState<'existing' | 'guest'>('existing')
  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState<number>()
  const [chosenCustomer, setChosenCustomer] = useState<IntakeCustomer>()
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [promisedDate, setPromisedDate] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<DraftItem[]>([{ key: 1, serviceId: 0, sharingMode: 'ANY', quantity: 1 }])
  const [quotes, setQuotes] = useState<Record<number, PricingPreview>>({})
  const [eligible, setEligible] = useState<Record<number, Array<{ id: number; nameVi: string }>>>({})
  const [formError, setFormError] = useState('')
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false)
  const [createBatchAfterSave, setCreateBatchAfterSave] = useState(false)
  const canCreateBatch = hasPermission(PERMISSION_CODES.BATCH_CREATE)
  const pricingItems = usePricingInputs(items)
  const customers = useQuery({ queryKey: ['orders', 'customer-search', branchId, search], queryFn: () => orderApi.customers(branchId!, search), enabled: mode === 'existing' && Boolean(branchId) && search.trim().length >= 2 })
  const services = useQuery({ queryKey: ['orders', 'service-options', branchId], queryFn: () => orderApi.services(branchId!), enabled: Boolean(branchId) })
  const updateItem = (key: number, patch: Partial<DraftItem>) => setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item))
  const hasPrivateLoad = items.some((item) => item.sharingMode === 'PRIVATE_LOAD')
  const shouldCreateBatch = canCreateBatch && (createBatchAfterSave || hasPrivateLoad)
  const serviceGroupCount = new Set(items.filter((item) => item.serviceId).map((item) => item.serviceId)).size

  useEffect(() => {
    const valid = pricingItems.filter((item): item is PricingDraftItem & { itemTypeId: number } => Boolean(item.serviceId && item.itemTypeId && item.quantity > 0))
    if (!branchId || !valid.length) { setQuotes({}); return }
    const timer = window.setTimeout(() => {
      void Promise.all(valid.map(async (item) => [item.key, await orderApi.preview(branchId, item)] as const))
        .then((result) => { setQuotes(Object.fromEntries(result)); setFormError('') })
        .catch(() => { setQuotes({}); setFormError('Không tìm thấy mức giá hiệu lực cho một dịch vụ.') })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [branchId, pricingItems])

  const create = useMutation({
    mutationFn: async () => {
      const order = await orderApi.create({
        branchId: branchId!, customerId: mode === 'existing' ? customerId : undefined,
        guestName: mode === 'guest' ? guestName : undefined, guestPhone: mode === 'guest' ? guestPhone : undefined,
        promisedAt: promisedDate ? promisedDateInstant(promisedDate) : undefined, note: note || undefined,
        items: items.map(({ serviceId, itemTypeId, sharingMode, priorityLevel, quantity, note: itemNote }) => ({ serviceId, itemTypeId: itemTypeId!, sharingMode, priorityLevel, quantity, note: itemNote })),
      })
      if (!shouldCreateBatch) return { order, batchCount: 0, batchFailures: 0 }
      const groupedItems = new Map<number, number[]>()
      order.items.forEach((item) => groupedItems.set(item.serviceId, [...(groupedItems.get(item.serviceId) ?? []), item.id]))
      const results = await Promise.allSettled([...groupedItems.values()].map((orderItemIds) => washBatchApi.create({
        branchId: order.branchId,
        orderItemIds,
        note: `Tạo trực tiếp từ ${order.orderCode}`,
        markReady: false,
      })))
      return { order, batchCount: results.filter((result) => result.status === 'fulfilled').length, batchFailures: results.filter((result) => result.status === 'rejected').length }
    },
    onSuccess: ({ order, batchCount, batchFailures }) => {
      if (batchFailures) notify({ title: 'Đã tạo đơn hàng', message: `${order.orderCode} đã lưu; ${batchFailures} mẻ chưa tạo được. Bạn có thể ghép lại tại danh sách đơn.`, tone: 'info' })
      else notify({ title: 'Đã tạo đơn hàng', message: batchCount ? `${order.orderCode} · Đã tạo ${batchCount} mẻ nháp riêng` : order.orderCode, tone: 'success' })
      navigate(`/orders/${order.id}`, { replace: true })
    },
  })
  useEffect(() => {
    const dirty = Boolean(customerId || guestName || guestPhone || note || promisedDate || createBatchAfterSave || items.some((item) => item.serviceId))
    const warn = (event: BeforeUnloadEvent) => { if (dirty && !create.isSuccess) event.preventDefault() }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [create.isSuccess, createBatchAfterSave, customerId, guestName, guestPhone, items, note, promisedDate])
  const selectService = (key: number, serviceId: number) => {
    updateItem(key, { serviceId, itemTypeId: undefined })
    if (serviceId && branchId) void orderApi.eligibility(branchId, serviceId).then((value) => setEligible((current) => ({ ...current, [key]: value })))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'existing' && !customerId) return setFormError('Hãy chọn một khách hàng.')
    if (mode === 'guest' && !guestName.trim() && !guestPhone.trim()) return setFormError('Nhập tên hoặc số điện thoại khách vãng lai.')
    if (!items.every((item) => item.serviceId && item.itemTypeId && item.quantity > 0)) return setFormError('Mỗi dịch vụ phải có loại đồ cụ thể.')
    if (formError) return
    create.mutate()
  }
  const total = Object.values(quotes).reduce((sum, value) => sum + value.finalAmount, 0)
  const customerSummary = mode === 'existing'
    ? chosenCustomer ? { name: chosenCustomer.fullName, phone: chosenCustomer.phone } : undefined
    : (guestName.trim() || guestPhone.trim()) ? { name: guestName.trim() || 'Khách vãng lai', phone: guestPhone.trim() } : undefined
  const validItemCount = items.filter((item) => item.serviceId && item.itemTypeId).length
  const readyToSubmit = Boolean(branchId && customerSummary && items.every((item) => item.serviceId && item.itemTypeId && item.quantity > 0) && !formError)

  return <form className="page-container order-create" onSubmit={submit}>
    <nav className="order-breadcrumb" aria-label="Đường dẫn"><Link to="/orders">Đơn hàng</Link><ChevronRight size={15} /><span>Tạo đơn hàng</span></nav>
    <header className="order-create-heading"><div><h1>Tạo đơn hàng</h1><p>Tiếp nhận đơn mới tại quầy</p></div><ButtonLink to="/orders" variant="secondary"><ArrowLeft size={18} />Quay lại</ButtonLink></header>
    <ol className="order-steps" aria-label="Tiến trình tạo đơn">
      <li className="active"><span>1</span><div><strong>Khách hàng</strong><small>Chọn hoặc tạo khách hàng</small></div></li>
      <li className={customerSummary ? 'complete' : ''}><span>2</span><div><strong>Dịch vụ</strong><small>Thêm dịch vụ và thông tin</small></div></li>
      <li className={validItemCount ? 'complete' : ''}><span>3</span><div><strong>Hẹn trả</strong><small>Xác nhận và hoàn tất</small></div></li>
    </ol>
    <div className="order-create-grid"><div className="order-form-stack">
      <Surface className="order-section order-section--customer"><div className="section-title"><span>1</span><div><h2>Thông tin khách hàng</h2><p>Tìm kiếm khách hàng có sẵn hoặc ghi nhận khách vãng lai.</p></div></div>
        <div className="segmented" role="group" aria-label="Loại khách hàng"><button type="button" aria-pressed={mode === 'existing'} className={mode === 'existing' ? 'active' : ''} onClick={() => { setMode('existing'); setFormError('') }}><UserRound size={17} />Khách hàng có sẵn</button><button type="button" aria-pressed={mode === 'guest'} className={mode === 'guest' ? 'active' : ''} onClick={() => { setMode('guest'); setFormError('') }}><Plus size={17} />Khách vãng lai</button></div>
        {mode === 'existing' ? <><Field label="Tìm khách hàng" hint="Nhập tên, số điện thoại đầy đủ hoặc 3–4 số cuối"><div className="order-customer-search"><Search size={18} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập ít nhất 2 ký tự" /></div></Field>
          {customers.isFetching && <p className="order-search-status">Đang tìm khách hàng…</p>}
          {customers.data?.length ? <div className="customer-results" aria-label="Kết quả khách hàng">{customers.data.map((customer) => <button type="button" key={customer.id} className={`customer-result${customerId === customer.id ? ' selected' : ''}`} onClick={() => { setCustomerId(customer.id); setChosenCustomer(customer); setFormError('') }}><span className="customer-avatar" aria-hidden="true">{customer.fullName.trim().slice(0, 1).toUpperCase()}</span><span><strong>{customer.fullName}</strong><small>{customer.phone} · {customer.customerCode}</small></span>{customerId === customer.id ? <span className="customer-result__choice"><Check size={18} />Đã chọn</span> : <span className="customer-result__choice">Chọn</span>}</button>)}</div> : search.trim().length >= 2 && !customers.isFetching ? <p className="order-search-status">Không tìm thấy khách hàng phù hợp.</p> : null}</>
          : <><div className="form-grid"><Field label="Tên khách"><input value={guestName} onChange={(event) => { setGuestName(event.target.value); setFormError('') }} maxLength={150} placeholder="Nhập tên khách hàng" /></Field><Field label="Số điện thoại"><input type="tel" inputMode="tel" value={guestPhone} onChange={(event) => { setGuestPhone(event.target.value); setFormError('') }} maxLength={30} placeholder="Nhập số điện thoại" /></Field></div><p className="field-hint">Thông tin này chỉ được lưu trên đơn hàng, không tự tạo hồ sơ khách hàng.</p></>}
        {mode === 'existing' && hasPermission(PERMISSION_CODES.CUSTOMER_CREATE) && <Button type="button" variant="secondary" onClick={() => setQuickCustomerOpen(true)}><Plus size={18} />Tạo nhanh khách hàng</Button>}
      </Surface>
      <Surface className="order-section order-section--services"><div className="section-title"><span>2</span><div><h2>Dịch vụ</h2><p>Thêm dịch vụ vào đơn hàng, giá sẽ được tính tự động.</p></div></div>
        {items.map((item, index) => <div className="order-item-editor" key={item.key}><div className="order-item-editor__head"><strong>Dịch vụ {index + 1}</strong>{items.length > 1 && <button type="button" onClick={() => setItems((value) => value.filter((candidate) => candidate.key !== item.key))} aria-label={`Xóa dịch vụ ${index + 1}`}><Trash2 size={18} /></button>}</div>
          <div className="form-grid"><Field label="Dịch vụ" required><select value={item.serviceId || ''} onChange={(event) => selectService(item.key, Number(event.target.value))}><option value="">Chọn dịch vụ</option>{services.data?.map((service) => <option key={service.id} value={service.id}>{service.nameVi}</option>)}</select></Field>
            <Field label="Loại đồ" required><select value={item.itemTypeId || ''} onChange={(event) => updateItem(item.key, { itemTypeId: event.target.value ? Number(event.target.value) : undefined })}><option value="">Chọn loại đồ</option>{eligible[item.key]?.map((option) => <option key={option.id} value={option.id}>{option.nameVi}</option>)}</select></Field>
            <Field label="Hình thức xử lý" required><select value={item.sharingMode} onChange={(event) => updateItem(item.key, { sharingMode: event.target.value as DraftItem['sharingMode'], priorityLevel: event.target.value === 'SHARED_PRIORITY' ? 1 : undefined })}><option value="ANY">Theo dịch vụ</option><option value="SHARED_STANDARD">Giặt chung</option><option value="SHARED_PRIORITY">Giặt chung ưu tiên</option><option value="PRIVATE_LOAD">Giặt riêng mẻ</option></select></Field>
            <Field label="Số lượng / khối lượng" required><input inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(item.key, { quantity: Number(event.target.value) })} /></Field></div>
          <Field label="Ghi chú xử lý" hint={`${item.note?.length ?? 0}/1000 · Tình trạng món hoặc yêu cầu riêng`}><textarea rows={2} maxLength={1000} value={item.note ?? ''} onChange={(event) => updateItem(item.key, { note: event.target.value })} placeholder="Ví dụ: vết bẩn, giặt riêng, yêu cầu đặc biệt…" /></Field>
          {quotes[item.key] !== undefined && <div className="quoted-price"><span><small>{quotes[item.key].explanation}</small><small>Tính tiền: {quotes[item.key].billableQuantity} {quotes[item.key].unitType}</small></span><strong>{money(quotes[item.key].finalAmount, quotes[item.key].currency)}</strong></div>}
        </div>)}
        <Button type="button" variant="secondary" onClick={() => setItems((value) => [...value, { key: Date.now(), serviceId: 0, sharingMode: 'ANY', quantity: 1 }])}><Plus size={18} />Thêm dịch vụ</Button>
        {formError && <p className="form-error" role="alert">{formError}</p>}
      </Surface>
      <Surface className="order-section order-section--promise"><div className="section-title"><span>3</span><div><h2>Hẹn trả và ghi chú</h2><p>Chọn ngày hẹn trả và thêm thông tin bổ sung.</p></div></div><div className="form-grid"><DatePickerField label="Ngày hẹn trả" value={promisedDate} onChange={setPromisedDate} hint="Không cần chọn giờ." /><Field label="Ghi chú" hint={`${note.length}/2000`}><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={2} placeholder="Ghi chú thêm…" /></Field></div>
        {canCreateBatch && <label className="order-create-batch-choice"><input type="checkbox" checked={shouldCreateBatch} disabled={hasPrivateLoad} onChange={(event) => setCreateBatchAfterSave(event.target.checked)} /><span className="order-create-batch-choice__icon"><Layers3 size={20} /></span><span><strong>{hasPrivateLoad ? 'Tự tạo mẻ nháp riêng' : 'Tạo mẻ nháp riêng sau khi lưu'}</strong><small>{hasPrivateLoad ? 'Đơn có yêu cầu giặt riêng nên hệ thống sẽ tự tạo mẻ.' : `Không cần chuyển sang trang Mẻ giặt để tạo lại${serviceGroupCount > 1 ? `; hệ thống sẽ tách thành ${serviceGroupCount} mẻ theo dịch vụ` : ''}.`}</small></span></label>}
      </Surface>
    </div><Surface as="aside" className="order-summary"><div className="order-summary__head"><span><ClipboardList size={21} /></span><div><h2>Tóm tắt đơn hàng</h2><p>Thông tin đơn sẽ được cập nhật tự động.</p></div></div><div className="order-summary__body"><section><div className="order-summary__label"><span><UserRound size={18} /></span><strong>Khách hàng</strong></div>{customerSummary ? <div className="order-summary__selection"><strong>{customerSummary.name}</strong><small>{customerSummary.phone || 'Không có số điện thoại'}</small></div> : <div className="order-summary__placeholder"><strong>Chưa chọn khách hàng</strong><small>Vui lòng chọn hoặc nhập khách hàng.</small></div>}</section><section><div className="order-summary__label"><span><ShoppingBag size={18} /></span><strong>Dịch vụ</strong></div>{validItemCount ? <div className="order-summary__services">{items.filter((item) => item.serviceId && item.itemTypeId).map((item) => <div key={item.key}><span>{services.data?.find((service) => service.id === item.serviceId)?.nameVi ?? 'Dịch vụ'}</span><strong>{quotes[item.key] ? money(quotes[item.key].finalAmount, quotes[item.key].currency) : 'Đang tính…'}</strong></div>)}</div> : <div className="order-summary__placeholder"><strong>Chưa có dịch vụ</strong><small>Thêm dịch vụ để xem chi tiết.</small></div>}</section><dl><div><dt>Số dịch vụ</dt><dd>{validItemCount}</dd></div><div><dt>Tạm tính</dt><dd>{money(total, Object.values(quotes)[0]?.currency)}</dd></div><div><dt>Giảm giá</dt><dd>{money(0)}</dd></div><div><dt>Phụ phí</dt><dd>{money(0)}</dd></div><div className="order-summary__total"><dt>Tổng cộng</dt><dd>{money(total, Object.values(quotes)[0]?.currency)}</dd></div></dl><p className="order-summary__note">Giá cuối cùng được hệ thống tính lại khi lưu đơn.</p><Button type="submit" size="lg" loading={create.isPending} disabled={!readyToSubmit}>Lưu đơn hàng</Button>{create.error && <p className="form-error">{create.error instanceof ApiError ? create.error.message : 'Không thể tạo đơn.'}</p>}</div></Surface></div>
    <div className="mobile-order-action"><span><small>Tổng tạm tính</small><strong>{money(total, Object.values(quotes)[0]?.currency)}</strong></span><Button type="submit" loading={create.isPending} disabled={!readyToSubmit}>Tạo đơn</Button></div>
    <QuickCustomerDialog open={quickCustomerOpen} onClose={() => setQuickCustomerOpen(false)} onCreated={(customer) => { setCustomerId(customer.id); setChosenCustomer(customer); setSearch(customer.fullName) }} />
  </form>
}

function nextAction(order: Order) {
  if (order.status === 'RECEIVED' || order.status === 'REOPENED') return ['start-processing', 'Bắt đầu xử lý', PERMISSION_CODES.ORDER_START_PROCESSING] as const
  if (order.status === 'PROCESSING') return ['mark-ready', 'Đánh dấu sẵn sàng', PERMISSION_CODES.ORDER_MARK_READY] as const
  if (order.status === 'READY') return ['complete', 'Hoàn tất đơn', PERMISSION_CODES.ORDER_COMPLETE] as const
  return null
}

function OrderEditPanel({ order, onSaved, onClose }: { order: Order; onSaved: (value: Order) => void; onClose: () => void }) {
  const { subscribe } = useRealtime()
  const { notify } = useToast()
  const structural = order.status === 'RECEIVED'
  const [promisedDate, setPromisedDate] = useState(promisedDateKey(order.promisedAt))
  const [note, setNote] = useState(order.note ?? '')
  const initialItems = order.items.map(item => ({ key: item.id, serviceId: item.serviceId, itemTypeId: item.itemTypeId, sharingMode: item.sharingMode, quantity: item.quantity, note: item.note }))
  const [items, setItems] = useState<DraftItem[]>(initialItems)
  const [eligible, setEligible] = useState<Record<number, Array<{ id: number; nameVi: string }>>>({})
  const [quotes, setQuotes] = useState<Record<number, PricingPreview>>({})
  const [pricingError, setPricingError] = useState('')
  const [stale, setStale] = useState(false)
  const services = useQuery({ queryKey: ['orders', 'service-options', order.branchId], queryFn: () => orderApi.services(order.branchId), enabled: structural })
  const pricingItems = usePricingInputs(items)
  const pricingRelevantChanged = structural && pricingInputSignature(items) !== pricingInputSignature(initialItems)
  const itemNoteUpdates: OrderItemNoteUpdate[] = structural ? items.flatMap(item => {
    const initial = initialItems.find(candidate => candidate.key === item.key)
    if (!initial || normalizedItemNote(item.note) === normalizedItemNote(initial.note)) return []
    return [{ itemId: item.key, note: normalizedItemNote(item.note) }]
  }) : []
  const metadataChanged = promisedDate !== promisedDateKey(order.promisedAt) || note !== (order.note ?? '')
  const dirty = metadataChanged || pricingRelevantChanged || itemNoteUpdates.length > 0

  useEffect(() => subscribe('order.', event => {
    if (event.entityId === order.id && dirty) setStale(true)
  }), [dirty, order.id, subscribe])
  useEffect(() => {
    if (!structural) return
    const serviceIds = [...new Set(pricingItems.map(item => item.serviceId).filter(Boolean))]
    void Promise.all(serviceIds.map(async serviceId => [serviceId, await orderApi.eligibility(order.branchId, serviceId)] as const))
      .then(values => setEligible(Object.fromEntries(values)))
  }, [order.branchId, pricingItems, structural])
  useEffect(() => {
    if (!structural || !pricingRelevantChanged) { setQuotes({}); setPricingError(''); return }
    const valid = pricingItems.filter((item): item is PricingDraftItem & { itemTypeId: number } => Boolean(item.serviceId && item.itemTypeId && item.quantity > 0))
    if (valid.length !== pricingItems.length) { setQuotes({}); return }
    const timer = window.setTimeout(() => {
      void Promise.all(valid.map(async item => [item.key, await orderApi.preview(order.branchId, item)] as const))
        .then(values => { setQuotes(Object.fromEntries(values)); setPricingError('') })
        .catch(() => { setQuotes({}); setPricingError('Không thể tính lại giá. Kiểm tra loại đồ và bảng giá hiệu lực.') })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [order.branchId, pricingItems, pricingRelevantChanged, structural])

  const save = useMutation({
    mutationFn: () => {
      const body: { version: number; promisedAt?: string | null; note?: string | null; items?: OrderItemPayload[]; itemNoteUpdates?: OrderItemNoteUpdate[] } = { version: order.version }
      if (promisedDate !== promisedDateKey(order.promisedAt)) body.promisedAt = promisedDate ? promisedDateInstant(promisedDate) : null
      if (note !== (order.note ?? '')) body.note = note.trim() || null
      if (pricingRelevantChanged) body.items = items.map(({ serviceId, itemTypeId, sharingMode, priorityLevel, quantity, note: itemNote }) => ({ serviceId, itemTypeId: itemTypeId!, sharingMode, priorityLevel, quantity, note: itemNote }))
      else if (itemNoteUpdates.length) body.itemNoteUpdates = itemNoteUpdates
      return orderApi.update(order.id, order.branchId, body)
    },
    onSuccess: value => {
      const message = pricingRelevantChanged ? 'Đã cập nhật đơn và tính lại giá.'
        : itemNoteUpdates.length > 0 && !metadataChanged ? 'Đã cập nhật ghi chú xử lý.' : 'Đã cập nhật đơn hàng.'
      notify({ message, tone: 'success' }); onSaved(value)
    },
    onError: error => {
      if (error instanceof ApiError && error.status === 409) setStale(true)
      else notify({ message: error instanceof ApiError ? error.message : 'Không thể cập nhật đơn.', tone: 'error' })
    },
  })
  const updateItem = (key: number, patch: Partial<DraftItem>) => setItems(current => current.map(item => item.key === key ? { ...item, ...patch } : item))
  const selectService = (key: number, serviceId: number) => {
    updateItem(key, { serviceId, itemTypeId: undefined })
    if (serviceId) void orderApi.eligibility(order.branchId, serviceId).then(value => setEligible(current => ({ ...current, [serviceId]: value })))
  }
  const valid = items.length > 0 && items.every(item => item.serviceId && item.itemTypeId && item.quantity > 0)
  const repricedTotal = pricingRelevantChanged && Object.keys(quotes).length === items.length
    ? Object.values(quotes).reduce((sum, quote) => sum + quote.finalAmount, 0) : order.totalAmount

  return <Surface className="order-edit-panel">
    <div className="order-edit-panel__header"><div><h2>Chỉnh sửa đơn hàng</h2><p>{structural ? 'Thay đổi dịch vụ sẽ được backend tính giá lại.' : 'Trạng thái hiện tại chỉ cho phép sửa hẹn trả và ghi chú.'}</p></div><Button type="button" variant="ghost" onClick={onClose}>Đóng</Button></div>
    {stale && <div className="order-stale-warning" role="alert"><div><strong>Đơn hàng vừa được người khác cập nhật.</strong><span>Dữ liệu bạn đang nhập vẫn được giữ. Tải bản mới trước khi lưu.</span></div><Button type="button" variant="secondary" onClick={() => window.location.reload()}><RefreshCw size={17} />Tải bản mới</Button></div>}
    {structural && <div className="order-edit-items">{items.map((item, index) => <div className="order-item-editor" key={item.key}><div className="order-item-editor__head"><strong>Dịch vụ {index + 1}</strong>{items.length > 1 && <button type="button" onClick={() => setItems(current => current.filter(candidate => candidate.key !== item.key))} aria-label="Xóa dịch vụ"><X size={18} /></button>}</div><div className="form-grid">
      <Field label="Dịch vụ" required><select value={item.serviceId || ''} onChange={event => selectService(item.key, Number(event.target.value))}><option value="">Chọn dịch vụ</option>{services.data?.map(service => <option key={service.id} value={service.id}>{service.nameVi}</option>)}</select></Field>
      <Field label="Loại đồ" required><select value={item.itemTypeId || ''} onChange={event => updateItem(item.key, { itemTypeId: event.target.value ? Number(event.target.value) : undefined })}><option value="">Chọn loại đồ</option>{eligible[item.serviceId]?.map(option => <option key={option.id} value={option.id}>{option.nameVi}</option>)}</select></Field>
      <Field label="Hình thức xử lý" required><select value={item.sharingMode} onChange={event => updateItem(item.key, { sharingMode: event.target.value as DraftItem['sharingMode'], priorityLevel: event.target.value === 'SHARED_PRIORITY' ? 1 : undefined })}><option value="ANY">Theo dịch vụ</option><option value="SHARED_STANDARD">Giặt chung</option><option value="SHARED_PRIORITY">Giặt chung ưu tiên</option><option value="PRIVATE_LOAD">Giặt riêng mẻ</option></select></Field>
      <Field label="Số lượng / khối lượng" required><input inputMode="decimal" value={item.quantity} onChange={event => updateItem(item.key, { quantity: Number(event.target.value) })} /></Field>
    </div><Field label="Ghi chú xử lý" hint="Tình trạng món hoặc yêu cầu riêng"><textarea rows={2} maxLength={1000} value={item.note ?? ''} onChange={event => updateItem(item.key, { note: event.target.value })} /></Field>{quotes[item.key] && <div className="quoted-price"><span><small>{quotes[item.key].explanation}</small></span><strong>{money(quotes[item.key].finalAmount, quotes[item.key].currency)}</strong></div>}</div>)}
      <Button type="button" variant="secondary" onClick={() => setItems(current => [...current, { key: Date.now(), serviceId: 0, sharingMode: 'ANY', quantity: 1 }])}><Plus size={18} />Thêm dịch vụ</Button>
      {pricingError && <p className="form-error" role="alert">{pricingError}</p>}
    </div>}
    <div className="form-grid order-edit-metadata"><DatePickerField label="Ngày hẹn trả" value={promisedDate} onChange={setPromisedDate} hint="Không cần chọn giờ." /><Field label="Ghi chú"><textarea rows={4} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></Field></div>
    <div className="order-edit-panel__footer"><span><small>{pricingRelevantChanged ? 'Tổng sau khi tính lại' : 'Tổng hiện tại'}</small><strong>{money(repricedTotal, Object.values(quotes)[0]?.currency ?? order.currency)}</strong></span><Button type="button" loading={save.isPending} disabled={!dirty || stale || !valid || Boolean(pricingError)} onClick={() => save.mutate()}>Lưu thay đổi</Button></div>
  </Surface>
}

const historyLabels: Record<string, string> = {
  CREATED: 'Tạo đơn hàng', STARTED_PROCESSING: 'Bắt đầu xử lý', MARKED_READY: 'Đánh dấu sẵn sàng',
  COMPLETED: 'Hoàn tất đơn hàng', CANCELLED: 'Hủy đơn hàng', REOPENED: 'Mở lại đơn hàng',
}
function historyLabel(action: string, changed?: Record<string, unknown>) {
  const fields = Array.isArray(changed?.fields) ? changed.fields as string[] : []
  if (action === 'UPDATED' && fields.includes('items')) return 'Cập nhật dịch vụ và tính lại giá'
  if (action === 'UPDATED' && fields.includes('itemNotes')) return 'Cập nhật ghi chú xử lý'
  if (action === 'UPDATED' && fields.includes('promisedAt')) return 'Cập nhật ngày hẹn trả'
  if (action === 'UPDATED' && fields.includes('note')) return 'Cập nhật ghi chú'
  return historyLabels[action] ?? 'Cập nhật đơn hàng'
}
function HistoryDetails({ changed, currency }: { changed?: Record<string, unknown>; currency: string }) {
  const items = changed?.items as { before?: Array<Record<string, unknown>>; after?: Array<Record<string, unknown>> } | undefined
  if (!items?.before || !items.after) return null
  const beforeTotal = items.before.reduce((sum, item) => sum + Number(item.lineAmount ?? 0), 0)
  const afterTotal = items.after.reduce((sum, item) => sum + Number(item.lineAmount ?? 0), 0)
  return <small className="history-change">{items.before.length} → {items.after.length} dịch vụ · {money(beforeTotal, currency)} → {money(afterTotal, currency)}</small>
}

export function OrderDetailPage() {
  const id = Number(useParams().orderId)
  const { branchId, hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const { subscribe } = useRealtime()
  const [editing, setEditing] = useState(false)
  const [reasonAction, setReasonAction] = useState<'cancel' | 'reopen' | null>(null)
  const [reason, setReason] = useState('')
  const order = useQuery({ queryKey: orderKeys.detail(id), queryFn: () => orderApi.get(id, branchId!), enabled: Boolean(id && branchId) })
  const canAudit = hasPermission(PERMISSION_CODES.ORDER_AUDIT_READ)
  const canReadBatches = hasPermission(PERMISSION_CODES.BATCH_READ)
  const history = useQuery({ queryKey: orderKeys.history(id), queryFn: () => orderApi.history(id, branchId!), enabled: Boolean(id && branchId && canAudit) })
  const batchReferences = useQuery({ queryKey: batchKeys.byOrder(id), queryFn: () => washBatchApi.byOrder(id, branchId!), enabled: Boolean(id && branchId && canReadBatches) })
  useEffect(() => subscribe('order.', event => {
    if (event.entityId !== id || editing) return
    void queryClient.invalidateQueries({ queryKey: orderKeys.detail(id), refetchType: 'active' })
    void queryClient.invalidateQueries({ queryKey: orderKeys.history(id), refetchType: 'active' })
    void queryClient.invalidateQueries({ queryKey: orderKeys.all, refetchType: 'none' })
  }), [editing, id, queryClient, subscribe])
  useEffect(() => subscribe('realtime.reconnected', () => {
    void queryClient.invalidateQueries({ queryKey: orderKeys.detail(id), refetchType: 'active' })
    if (canAudit) void queryClient.invalidateQueries({ queryKey: orderKeys.history(id), refetchType: 'active' })
  }), [canAudit, id, queryClient, subscribe])
  useEffect(() => subscribe('batch.', () => {
    if (canReadBatches) void queryClient.invalidateQueries({ queryKey: batchKeys.byOrder(id) })
  }), [canReadBatches, id, queryClient, subscribe])
  const mutate = useMutation({
    mutationFn: async ({ action, reason }: { action: string; reason?: string }) => {
      const value = order.data!
      return action === 'cancel' || action === 'reopen'
        ? orderApi.reasoned(value.id, value.branchId, action, value.version, reason!)
        : orderApi.transition(value.id, value.branchId, action as 'start-processing' | 'mark-ready' | 'complete', value.version)
    },
    onSuccess: (value) => { setReasonAction(null); setReason(''); queryClient.setQueryData(orderKeys.detail(id), value); void history.refetch(); void queryClient.invalidateQueries({ queryKey: orderKeys.all }); notify({ message: 'Đã cập nhật trạng thái đơn.', tone: 'success' }) },
    onError: (error) => notify({ message: error instanceof ApiError && error.status === 409 ? 'Đơn vừa được người khác cập nhật. Hãy tải lại rồi thử lại.' : 'Không thể cập nhật trạng thái đơn.', tone: 'error' }),
  })
  if (order.isLoading) return <div className="page-container"><LoadingState /></div>
  if (order.isError || !order.data) return <div className="page-container"><ErrorState title="Không tải được đơn hàng" body="Đơn không tồn tại hoặc nằm ngoài chi nhánh của bạn." onRetry={() => void order.refetch()} /></div>
  const value = order.data
  const action = nextAction(value)
  const execute = (name: string) => {
    if (name === 'cancel' || name === 'reopen') {
      setReason('')
      setReasonAction(name)
    } else mutate.mutate({ action: name })
  }
  return <div className="page-container order-detail"><header className="order-detail-header"><div><Link to="/orders"><ArrowLeft size={18} />Đơn hàng</Link><div><h1>{value.orderCode}</h1><Status value={value.status} /></div><p>Nhận lúc {when(value.createdAt)} · {value.branchCode}</p></div><div>
    {(['RECEIVED', 'PROCESSING', 'READY'] as OrderStatus[]).includes(value.status) && hasPermission(PERMISSION_CODES.ORDER_UPDATE) && <Button variant="secondary" onClick={() => setEditing(current => !current)}><Pencil size={17} />{editing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa'}</Button>}
    {action && hasPermission(action[2]) && <Button loading={mutate.isPending} onClick={() => execute(action[0])}><PackageCheck size={18} />{action[1]}</Button>}
    {(['RECEIVED', 'PROCESSING', 'READY'] as OrderStatus[]).includes(value.status) && hasPermission(PERMISSION_CODES.ORDER_CANCEL) && <Button variant="danger" onClick={() => execute('cancel')}>Hủy đơn</Button>}
    {value.status === 'COMPLETED' && hasPermission(PERMISSION_CODES.ORDER_REOPEN) && <Button variant="secondary" onClick={() => execute('reopen')}><RotateCcw size={18} />Mở lại</Button>}
  </div></header>{editing && <OrderEditPanel order={value} onClose={() => setEditing(false)} onSaved={updated => { queryClient.setQueryData(orderKeys.detail(id), updated); void history.refetch(); void queryClient.invalidateQueries({ queryKey: orderKeys.all }); setEditing(false) }} />}<div className="order-detail-grid"><div className="order-detail-main">
    <Surface className="order-section"><h2>Thông tin chung</h2><dl className="detail-facts"><div><dt>Khách hàng</dt><dd>{value.customerName || 'Khách vãng lai'}<small>{value.customerPhone}</small></dd></div><div><dt>Ngày hẹn trả</dt><dd>{value.promisedAt ? promisedDateLabel(value.promisedAt) : 'Chưa hẹn'}</dd></div><div><dt>Nhân viên nhận</dt><dd>{value.createdBy.displayName}</dd></div><div><dt>Cập nhật cuối</dt><dd>{when(value.updatedAt)}</dd></div></dl></Surface>
    <Surface className="order-section"><h2>Dịch vụ ({value.items.length})</h2>{value.items.map((item) => <article className="detail-order-item" key={item.id}><div><strong>{item.serviceName}</strong><span>{item.itemTypeName}</span>{item.note && <small className="detail-order-item__note"><strong>Ghi chú:</strong> {item.note}</small>}</div><div><span>{item.quantity} {item.unitType}</span><strong>{money(item.lineAmount, value.currency)}</strong></div></article>)}</Surface>
    {value.note && <Surface className="order-section"><h2>Ghi chú</h2><p>{value.note}</p></Surface>}
  </div><aside><Surface className="order-total"><span>Tổng tiền</span><strong>{money(value.totalAmount, value.currency)}</strong><small>{value.currency} · giá đã đóng băng khi nhận đơn</small></Surface>
    {canReadBatches && <Surface className="order-batch-references"><h2>Mẻ giặt liên quan</h2>{batchReferences.isLoading ? <LoadingState rows={2} /> : batchReferences.isError ? <ErrorState title="Không tải được mẻ giặt" body="Thông tin đơn vẫn an toàn. Hãy thử tải lại phần này." onRetry={() => void batchReferences.refetch()} /> : batchReferences.data?.length ? batchReferences.data.map(batch => <Link key={batch.id} to={`/wash-batches/${batch.id}`}><span><strong>{batch.batchCode}</strong><small>{batch.serviceName}</small></span><b>{batch.active ? 'Đang hoạt động' : batch.status === 'CANCELLED' ? 'Đã hủy' : batch.status}</b></Link>) : <p>Đơn chưa được xếp vào mẻ giặt.</p>}</Surface>}
    {canAudit && <Surface className="order-history"><h2>Lịch sử đơn hàng</h2>{history.isLoading ? <LoadingState rows={3} /> : history.isError ? <ErrorState title="Không tải được lịch sử" body="Thử tải lại để xem thay đổi của đơn." onRetry={() => void history.refetch()} /> : history.data?.map((item) => <article key={item.id}><span className="history-dot"><Clock3 size={14} /></span><div><strong>{historyLabel(item.action, item.changedFields)}</strong><p>{item.actor.displayName} · {when(item.createdAt)}</p><HistoryDetails changed={item.changedFields} currency={value.currency} />{item.reason && <small>{item.reason}</small>}</div></article>)}</Surface>}
  </aside></div><OverlayDialog open={reasonAction !== null} onClose={() => !mutate.isPending && setReasonAction(null)} title={reasonAction === 'cancel' ? 'Hủy đơn hàng' : 'Mở lại đơn hàng'} description="Lý do sẽ được lưu trong lịch sử kiểm toán." footer={<><Button variant="secondary" onClick={() => setReasonAction(null)} disabled={mutate.isPending}>Đóng</Button><Button variant={reasonAction === 'cancel' ? 'danger' : 'primary'} loading={mutate.isPending} disabled={!reason.trim()} onClick={() => reasonAction && mutate.mutate({ action: reasonAction, reason: reason.trim() })}>{reasonAction === 'cancel' ? 'Xác nhận hủy' : 'Xác nhận mở lại'}</Button></>}><Field label="Lý do" required><textarea rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} autoFocus /></Field></OverlayDialog></div>
}
