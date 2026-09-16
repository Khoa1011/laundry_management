import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock3, Filter, PackageCheck, Pencil, Plus, RefreshCw, RotateCcw, Search, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { Field } from '../../components/Field'
import { OverlayDialog } from '../../components/OverlayDialog'
import { ErrorState, LoadingState, StatePanel } from '../../components/States'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Surface } from '../../components/ui/Surface'
import { useToast } from '../../providers/ToastProvider'
import { useRealtime } from '../../realtime/context'
import { QuickCustomerDialog } from '../customers/QuickCustomerDialog'
import type { PricingPreview } from '../service-catalog/types'
import { orderApi, orderKeys } from './api'
import { localDayStartIso, nextLocalDayStartIso } from './dateFilters'
import type { Order, OrderItemPayload, OrderStatus } from './types'

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
const localDateTime = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function Status({ value }: { value: OrderStatus }) {
  return <span className={`order-status order-status--${value.toLowerCase()}`}>{statusText[value]}</span>
}

export function OrderListPage() {
  const { branchId, hasPermission } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { subscribe } = useRealtime()
  const [status, setStatus] = useState<OrderStatus>()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const canCreate = hasPermission(PERMISSION_CODES.ORDER_CREATE)
  const query = useQuery({
    queryKey: orderKeys.list(branchId, status, search, page, from, to),
    queryFn: () => orderApi.list({ branchId: branchId!, status, search: search || undefined, page, size: 20,
      from: from ? localDayStartIso(from) : undefined,
      to: to ? nextLocalDayStartIso(to) : undefined }),
    enabled: Boolean(branchId),
  })
  useEffect(() => subscribe('order.', () => {
    void queryClient.invalidateQueries({ queryKey: orderKeys.all, refetchType: 'active' })
  }), [queryClient, subscribe])
  useEffect(() => subscribe('realtime.reconnected', () => {
    void queryClient.invalidateQueries({ queryKey: orderKeys.all, refetchType: 'active' })
  }), [queryClient, subscribe])

  return <div className="page-container orders-page">
    <header className="orders-heading">
      <div><p className="eyebrow">Vận hành tại quầy</p><h1>Đơn hàng</h1><p>Theo dõi đơn theo trạng thái và cập nhật theo thời gian thực.</p></div>
      {canCreate && <ButtonLink to="/orders/new" variant="create"><Plus size={18} />Tạo đơn hàng</ButtonLink>}
    </header>
    <div className="order-tabs" role="tablist" aria-label="Trạng thái đơn">
      {([undefined, 'RECEIVED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED', 'REOPENED'] as const).map((value) =>
        <button key={value ?? 'all'} className={status === value ? 'active' : ''} onClick={() => { setStatus(value); setPage(0) }}>
          {value ? statusText[value] : 'Tất cả'}
        </button>)}
    </div>
    <Surface className="orders-list-surface">
      <div className="orders-toolbar">
        <label className="order-search"><Search size={18} /><span className="sr-only">Tìm đơn</span>
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Mã đơn, tên khách, số điện thoại, dịch vụ" />
        </label><span>{query.data?.totalElements ?? 0} đơn</span>
      </div>
      <details className="orders-advanced-filters"><summary><Filter size={17} />Lọc theo ngày nhận{(from || to) && <span>Đang áp dụng</span>}</summary><div>
        <Field label="Từ ngày"><input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(0) }} /></Field>
        <Field label="Đến ngày"><input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(0) }} /></Field>
        {(from || to) && <Button variant="ghost" type="button" onClick={() => { setFrom(''); setTo(''); setPage(0) }}>Xóa lọc</Button>}
      </div></details>
      {query.isLoading ? <LoadingState rows={6} /> : query.isError
        ? <ErrorState title="Không tải được đơn hàng" body="Kiểm tra kết nối rồi thử lại." onRetry={() => void query.refetch()} />
        : !query.data?.items.length
          ? <StatePanel title="Chưa có đơn phù hợp" body="Thử đổi trạng thái, từ khóa hoặc tạo đơn hàng đầu tiên." action={canCreate ? <ButtonLink to="/orders/new">Tạo đơn hàng</ButtonLink> : undefined} />
          : <>
            <div className="orders-mobile-list">{query.data.items.map((order) =>
              <button className="order-card" key={order.id} onClick={() => navigate(`/orders/${order.id}`)}>
                <div><strong>{order.orderCode}</strong><Status value={order.status} /></div>
                <h2>{order.customerName || 'Khách vãng lai'}</h2>{order.customerPhone && <p>{order.customerPhone}</p>}<p>{order.serviceSummary || 'Dịch vụ giặt là'}</p>
                <div><span>{when(order.createdAt)}</span><strong>{money(order.totalAmount, order.currency)}</strong><ChevronRight size={18} /></div>
              </button>)}</div>
            <div className="orders-table-wrap"><table className="orders-table"><thead><tr>
              <th>Mã đơn</th><th>Thời gian nhận</th><th>Khách hàng</th><th>Dịch vụ</th><th>Tổng tiền</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th>
            </tr></thead><tbody>{query.data.items.map((order) => <tr key={order.id}>
              <td><Link to={`/orders/${order.id}`}>{order.orderCode}</Link></td><td>{when(order.createdAt)}</td>
              <td><strong>{order.customerName || 'Khách vãng lai'}</strong><small>{order.customerPhone}</small></td>
              <td>{order.serviceSummary}</td><td>{money(order.totalAmount, order.currency)}</td><td><Status value={order.status} /></td>
              <td><ButtonLink size="sm" variant="ghost" to={`/orders/${order.id}`}>Xem</ButtonLink></td>
            </tr>)}</tbody></table></div>
            {query.data.totalPages > 1 && <nav className="orders-pagination" aria-label="Phân trang đơn hàng">
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={17} />Trước</Button>
              <span>Trang {page + 1} / {query.data.totalPages}</span>
              <Button variant="secondary" size="sm" disabled={page + 1 >= query.data.totalPages} onClick={() => setPage((value) => value + 1)}>Sau<ChevronRight size={17} /></Button>
            </nav>}
          </>}
    </Surface>
  </div>
}

type DraftItem = Omit<OrderItemPayload, 'itemTypeId'> & { key: number; itemTypeId?: number }

export function OrderCreatePage() {
  const { branchId, hasPermission } = useAuth()
  const navigate = useNavigate()
  const { notify } = useToast()
  const [mode, setMode] = useState<'existing' | 'guest'>('existing')
  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState<number>()
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [promisedAt, setPromisedAt] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<DraftItem[]>([{ key: 1, serviceId: 0, sharingMode: 'ANY', quantity: 1 }])
  const [quotes, setQuotes] = useState<Record<number, PricingPreview>>({})
  const [eligible, setEligible] = useState<Record<number, Array<{ id: number; nameVi: string }>>>({})
  const [formError, setFormError] = useState('')
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false)
  const customers = useQuery({ queryKey: ['orders', 'customer-search', branchId, search], queryFn: () => orderApi.customers(branchId!, search), enabled: mode === 'existing' && Boolean(branchId) && search.trim().length >= 2 })
  const services = useQuery({ queryKey: ['orders', 'service-options', branchId], queryFn: () => orderApi.services(branchId!), enabled: Boolean(branchId) })
  const updateItem = (key: number, patch: Partial<DraftItem>) => setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item))

  useEffect(() => {
    const valid = items.filter((item): item is DraftItem & { itemTypeId: number } => Boolean(item.serviceId && item.itemTypeId && item.quantity > 0))
    if (!branchId || !valid.length) { setQuotes({}); return }
    const timer = window.setTimeout(() => {
      void Promise.all(valid.map(async (item) => [item.key, await orderApi.preview(branchId, item)] as const))
        .then((result) => { setQuotes(Object.fromEntries(result)); setFormError('') })
        .catch(() => { setQuotes({}); setFormError('Không tìm thấy mức giá hiệu lực cho một dịch vụ.') })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [branchId, items])

  const create = useMutation({
    mutationFn: () => orderApi.create({
      branchId: branchId!, customerId: mode === 'existing' ? customerId : undefined,
      guestName: mode === 'guest' ? guestName : undefined, guestPhone: mode === 'guest' ? guestPhone : undefined,
      promisedAt: promisedAt ? new Date(promisedAt).toISOString() : undefined, note: note || undefined,
      items: items.map(({ serviceId, itemTypeId, sharingMode, priorityLevel, quantity, note: itemNote }) => ({ serviceId, itemTypeId: itemTypeId!, sharingMode, priorityLevel, quantity, note: itemNote })),
    }),
    onSuccess: (order) => { notify({ title: 'Đã tạo đơn hàng', message: order.orderCode, tone: 'success' }); navigate(`/orders/${order.id}`, { replace: true }) },
  })
  useEffect(() => {
    const dirty = Boolean(customerId || guestName || guestPhone || note || promisedAt || items.some((item) => item.serviceId))
    const warn = (event: BeforeUnloadEvent) => { if (dirty && !create.isSuccess) event.preventDefault() }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [create.isSuccess, customerId, guestName, guestPhone, items, note, promisedAt])
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

  return <form className="page-container order-create" onSubmit={submit}>
    <header className="focused-page-header"><ButtonLink to="/orders" variant="ghost"><ArrowLeft size={18} />Đơn hàng</ButtonLink><div><p className="eyebrow">Tiếp nhận tại quầy</p><h1>Tạo đơn hàng</h1></div></header>
    <div className="order-create-grid"><div className="order-form-stack">
      <Surface className="order-section"><div className="section-title"><span>1</span><div><h2>Khách hàng</h2><p>Chọn hồ sơ có sẵn hoặc ghi nhận khách vãng lai.</p></div></div>
        <div className="segmented"><button type="button" className={mode === 'existing' ? 'active' : ''} onClick={() => setMode('existing')}>Khách có sẵn</button><button type="button" className={mode === 'guest' ? 'active' : ''} onClick={() => setMode('guest')}>Khách vãng lai</button></div>
        {mode === 'existing' ? <><Field label="Tìm khách hàng" hint="Tên, số điện thoại đầy đủ hoặc 3–4 số cuối"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập ít nhất 2 ký tự" /></Field>
          {customers.data?.map((customer) => <button type="button" key={customer.id} className={`customer-result${customerId === customer.id ? ' selected' : ''}`} onClick={() => setCustomerId(customer.id)}><span><strong>{customer.fullName}</strong><small>{customer.phone} · {customer.customerCode}</small></span>{customerId === customer.id ? <span className="customer-result__choice"><Check size={18} />Đã chọn</span> : <span className="customer-result__choice">Chọn</span>}</button>)}</>
          : <><div className="form-grid"><Field label="Tên khách"><input value={guestName} onChange={(event) => setGuestName(event.target.value)} maxLength={150} /></Field><Field label="Số điện thoại"><input type="tel" inputMode="tel" value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} maxLength={30} /></Field></div><p className="field-hint">Thông tin này chỉ được lưu trên đơn hàng, không tự tạo hồ sơ khách hàng.</p></>}
        {mode === 'existing' && hasPermission(PERMISSION_CODES.CUSTOMER_CREATE) && <Button type="button" variant="secondary" onClick={() => setQuickCustomerOpen(true)}><Plus size={18} />Tạo nhanh khách hàng</Button>}
      </Surface>
      <Surface className="order-section"><div className="section-title"><span>2</span><div><h2>Dịch vụ</h2><p>Giá được tính và xác nhận bởi hệ thống.</p></div></div>
        {items.map((item, index) => <div className="order-item-editor" key={item.key}><div className="order-item-editor__head"><strong>Dịch vụ {index + 1}</strong>{items.length > 1 && <button type="button" onClick={() => setItems((value) => value.filter((candidate) => candidate.key !== item.key))} aria-label="Xóa dịch vụ"><X size={18} /></button>}</div>
          <div className="form-grid"><Field label="Dịch vụ" required><select value={item.serviceId || ''} onChange={(event) => selectService(item.key, Number(event.target.value))}><option value="">Chọn dịch vụ</option>{services.data?.map((service) => <option key={service.id} value={service.id}>{service.nameVi}</option>)}</select></Field>
            <Field label="Loại đồ" required><select value={item.itemTypeId || ''} onChange={(event) => updateItem(item.key, { itemTypeId: event.target.value ? Number(event.target.value) : undefined })}><option value="">Chọn loại đồ</option>{eligible[item.key]?.map((option) => <option key={option.id} value={option.id}>{option.nameVi}</option>)}</select></Field>
            <Field label="Hình thức xử lý" required><select value={item.sharingMode} onChange={(event) => updateItem(item.key, { sharingMode: event.target.value as DraftItem['sharingMode'], priorityLevel: event.target.value === 'SHARED_PRIORITY' ? 1 : undefined })}><option value="ANY">Theo dịch vụ</option><option value="SHARED_STANDARD">Giặt chung</option><option value="SHARED_PRIORITY">Giặt chung ưu tiên</option><option value="PRIVATE_LOAD">Giặt riêng mẻ</option></select></Field>
            <Field label="Số lượng / khối lượng" required><input inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(item.key, { quantity: Number(event.target.value) })} /></Field></div>
          <Field label="Ghi chú xử lý" hint="Tình trạng món hoặc yêu cầu riêng"><textarea rows={2} maxLength={1000} value={item.note ?? ''} onChange={(event) => updateItem(item.key, { note: event.target.value })} /></Field>
          {quotes[item.key] !== undefined && <div className="quoted-price"><span><small>{quotes[item.key].explanation}</small><small>Tính tiền: {quotes[item.key].billableQuantity} {quotes[item.key].unitType}</small></span><strong>{money(quotes[item.key].finalAmount, quotes[item.key].currency)}</strong></div>}
        </div>)}
        <Button type="button" variant="secondary" onClick={() => setItems((value) => [...value, { key: Date.now(), serviceId: 0, sharingMode: 'ANY', quantity: 1 }])}><Plus size={18} />Thêm dịch vụ</Button>
        {formError && <p className="form-error" role="alert">{formError}</p>}
      </Surface>
      <Surface className="order-section"><div className="section-title"><span>3</span><div><h2>Hẹn trả và ghi chú</h2></div></div><Field label="Thời gian hẹn trả"><input type="datetime-local" value={promisedAt} onChange={(event) => setPromisedAt(event.target.value)} /></Field><Field label="Ghi chú"><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={4} /></Field></Surface>
    </div><Surface className="order-summary"><h2>Tóm tắt đơn hàng</h2><dl><div><dt>Số dịch vụ</dt><dd>{items.length}</dd></div><div><dt>Tổng tạm tính</dt><dd>{money(total, Object.values(quotes)[0]?.currency)}</dd></div></dl><p>Giá cuối cùng được backend tính lại khi lưu đơn.</p><Button type="submit" size="lg" loading={create.isPending} disabled={!branchId || Boolean(formError) || !items.every((item) => item.serviceId && item.itemTypeId)}>Lưu đơn hàng</Button>{create.error && <p className="form-error">{create.error instanceof ApiError ? create.error.message : 'Không thể tạo đơn.'}</p>}</Surface></div>
    <div className="mobile-order-action"><span><small>Tổng tạm tính</small><strong>{money(total, Object.values(quotes)[0]?.currency)}</strong></span><Button type="submit" loading={create.isPending} disabled={!branchId || Boolean(formError) || !items.every((item) => item.serviceId && item.itemTypeId)}>Tạo đơn</Button></div>
    <QuickCustomerDialog open={quickCustomerOpen} onClose={() => setQuickCustomerOpen(false)} onCreated={(customer) => { setCustomerId(customer.id); setSearch(customer.fullName) }} />
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
  const [promisedAt, setPromisedAt] = useState(localDateTime(order.promisedAt))
  const [note, setNote] = useState(order.note ?? '')
  const initialItems = order.items.map(item => ({ key: item.id, serviceId: item.serviceId, itemTypeId: item.itemTypeId, sharingMode: item.sharingMode, quantity: item.quantity, note: item.note }))
  const [items, setItems] = useState<DraftItem[]>(initialItems)
  const [eligible, setEligible] = useState<Record<number, Array<{ id: number; nameVi: string }>>>({})
  const [quotes, setQuotes] = useState<Record<number, PricingPreview>>({})
  const [pricingError, setPricingError] = useState('')
  const [stale, setStale] = useState(false)
  const services = useQuery({ queryKey: ['orders', 'service-options', order.branchId], queryFn: () => orderApi.services(order.branchId), enabled: structural })
  const comparableItems = (values: DraftItem[]) => values.map(item => ({
    serviceId: item.serviceId,
    itemTypeId: item.itemTypeId,
    sharingMode: item.sharingMode,
    quantity: item.quantity,
    note: item.note,
  }))
  const changedItems = structural && JSON.stringify(comparableItems(items)) !== JSON.stringify(comparableItems(initialItems))
  const dirty = promisedAt !== localDateTime(order.promisedAt) || note !== (order.note ?? '') || changedItems

  useEffect(() => subscribe('order.', event => {
    if (event.entityId === order.id && dirty) setStale(true)
  }), [dirty, order.id, subscribe])
  useEffect(() => {
    if (!structural) return
    const serviceIds = [...new Set(items.map(item => item.serviceId).filter(Boolean))]
    void Promise.all(serviceIds.map(async serviceId => [serviceId, await orderApi.eligibility(order.branchId, serviceId)] as const))
      .then(values => setEligible(Object.fromEntries(values)))
  }, [items, order.branchId, structural])
  useEffect(() => {
    if (!structural) return
    const valid = items.filter((item): item is DraftItem & { itemTypeId: number } => Boolean(item.serviceId && item.itemTypeId && item.quantity > 0))
    if (valid.length !== items.length) { setQuotes({}); return }
    const timer = window.setTimeout(() => {
      void Promise.all(valid.map(async item => [item.key, await orderApi.preview(order.branchId, item)] as const))
        .then(values => { setQuotes(Object.fromEntries(values)); setPricingError('') })
        .catch(() => { setQuotes({}); setPricingError('Không thể tính lại giá. Kiểm tra loại đồ và bảng giá hiệu lực.') })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [items, order.branchId, structural])

  const save = useMutation({
    mutationFn: () => {
      const body: { version: number; promisedAt?: string | null; note?: string | null; items?: OrderItemPayload[] } = { version: order.version }
      if (promisedAt !== localDateTime(order.promisedAt)) body.promisedAt = promisedAt ? new Date(promisedAt).toISOString() : null
      if (note !== (order.note ?? '')) body.note = note.trim() || null
      if (changedItems) body.items = items.map(({ serviceId, itemTypeId, sharingMode, priorityLevel, quantity, note: itemNote }) => ({ serviceId, itemTypeId: itemTypeId!, sharingMode, priorityLevel, quantity, note: itemNote }))
      return orderApi.update(order.id, order.branchId, body)
    },
    onSuccess: value => { notify({ message: 'Đã cập nhật đơn và tính lại giá.', tone: 'success' }); onSaved(value) },
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
  const repricedTotal = structural && Object.keys(quotes).length === items.length
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
    <div className="form-grid order-edit-metadata"><Field label="Thời gian hẹn trả"><input type="datetime-local" value={promisedAt} onChange={event => setPromisedAt(event.target.value)} /></Field><Field label="Ghi chú"><textarea rows={4} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></Field></div>
    <div className="order-edit-panel__footer"><span><small>{changedItems ? 'Tổng sau khi tính lại' : 'Tổng hiện tại'}</small><strong>{money(repricedTotal, Object.values(quotes)[0]?.currency ?? order.currency)}</strong></span><Button type="button" loading={save.isPending} disabled={!dirty || stale || !valid || Boolean(pricingError)} onClick={() => save.mutate()}>Lưu thay đổi</Button></div>
  </Surface>
}

const historyLabels: Record<string, string> = {
  CREATED: 'Tạo đơn hàng', STARTED_PROCESSING: 'Bắt đầu xử lý', MARKED_READY: 'Đánh dấu sẵn sàng',
  COMPLETED: 'Hoàn tất đơn hàng', CANCELLED: 'Hủy đơn hàng', REOPENED: 'Mở lại đơn hàng',
}
function historyLabel(action: string, changed?: Record<string, unknown>) {
  const fields = Array.isArray(changed?.fields) ? changed.fields as string[] : []
  if (action === 'UPDATED' && fields.includes('items')) return 'Cập nhật dịch vụ và tính lại giá'
  if (action === 'UPDATED' && fields.includes('promisedAt')) return 'Cập nhật thời gian hẹn trả'
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
  const history = useQuery({ queryKey: orderKeys.history(id), queryFn: () => orderApi.history(id, branchId!), enabled: Boolean(id && branchId && canAudit) })
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
    <Surface className="order-section"><h2>Thông tin chung</h2><dl className="detail-facts"><div><dt>Khách hàng</dt><dd>{value.customerName || 'Khách vãng lai'}<small>{value.customerPhone}</small></dd></div><div><dt>Hẹn trả</dt><dd>{value.promisedAt ? when(value.promisedAt) : 'Chưa hẹn'}</dd></div><div><dt>Nhân viên nhận</dt><dd>{value.createdBy.displayName}</dd></div><div><dt>Cập nhật cuối</dt><dd>{when(value.updatedAt)}</dd></div></dl></Surface>
    <Surface className="order-section"><h2>Dịch vụ ({value.items.length})</h2>{value.items.map((item) => <article className="detail-order-item" key={item.id}><div><strong>{item.serviceName}</strong><span>{item.itemTypeName}</span>{item.note && <small className="detail-order-item__note"><strong>Ghi chú:</strong> {item.note}</small>}</div><div><span>{item.quantity} {item.unitType}</span><strong>{money(item.lineAmount, value.currency)}</strong></div></article>)}</Surface>
    {value.note && <Surface className="order-section"><h2>Ghi chú</h2><p>{value.note}</p></Surface>}
  </div><aside><Surface className="order-total"><span>Tổng tiền</span><strong>{money(value.totalAmount, value.currency)}</strong><small>{value.currency} · giá đã đóng băng khi nhận đơn</small></Surface>
    {canAudit && <Surface className="order-history"><h2>Lịch sử đơn hàng</h2>{history.isLoading ? <LoadingState rows={3} /> : history.isError ? <ErrorState title="Không tải được lịch sử" body="Thử tải lại để xem thay đổi của đơn." onRetry={() => void history.refetch()} /> : history.data?.map((item) => <article key={item.id}><span className="history-dot"><Clock3 size={14} /></span><div><strong>{historyLabel(item.action, item.changedFields)}</strong><p>{item.actor.displayName} · {when(item.createdAt)}</p><HistoryDetails changed={item.changedFields} currency={value.currency} />{item.reason && <small>{item.reason}</small>}</div></article>)}</Surface>}
  </aside></div><OverlayDialog open={reasonAction !== null} onClose={() => !mutate.isPending && setReasonAction(null)} title={reasonAction === 'cancel' ? 'Hủy đơn hàng' : 'Mở lại đơn hàng'} description="Lý do sẽ được lưu trong lịch sử kiểm toán." footer={<><Button variant="secondary" onClick={() => setReasonAction(null)} disabled={mutate.isPending}>Đóng</Button><Button variant={reasonAction === 'cancel' ? 'danger' : 'primary'} loading={mutate.isPending} disabled={!reason.trim()} onClick={() => reasonAction && mutate.mutate({ action: reasonAction, reason: reason.trim() })}>{reasonAction === 'cancel' ? 'Xác nhận hủy' : 'Xác nhận mở lại'}</Button></>}><Field label="Lý do" required><textarea rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} autoFocus /></Field></OverlayDialog></div>
}
