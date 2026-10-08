import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, CalendarDays, Check, CheckCircle2, ChevronRight, ClipboardList, Clock3, Cog, Eye, FileText, Layers3, PackageCheck, Pencil, Plus, RefreshCw, RotateCcw, Search, Shirt, ShoppingBag, Timer, Trash2, UserRound, UserRoundCheck, WalletCards, WashingMachine, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { Field } from '../../components/Field'
import { OverlayDialog } from '../../components/OverlayDialog'
import { ErrorState, LoadingState, StatePanel } from '../../components/States'
import { BulkActionBar, OperationalListHeader, OperationalListShell, OperationalPagination, OperationalSearch, OperationalStatusTabs, SelectionCheckbox } from '../../components/operational-list/OperationalList'
import { useDebouncedValue } from '../../components/operational-list/useDebouncedValue'
import { ActionMenu } from '../../components/ui/ActionMenu'
import { Button, ButtonLink } from '../../components/ui/Button'
import { CollapsibleFilterPanel } from '../../components/ui/CollapsibleFilterPanel'
import { DatePickerField } from '../../components/ui/DatePickerField'
import { DateTimeText } from '../../components/ui/DateTimeText'
import { DetailSectionTitle } from '../../components/ui/DetailSectionTitle'
import { Surface } from '../../components/ui/Surface'
import { useToast } from '../../providers/ToastProvider'
import { useRealtime } from '../../realtime/context'
import { QuickCustomerDialog } from '../customers/QuickCustomerDialog'
import type { PricingPreview } from '../service-catalog/types'
import { batchKeys, washBatchApi } from '../wash-batches/api'
import { BatchStatusChip } from '../wash-batches/BatchComponents'
import { quantityText } from '../wash-batches/presentation'
import { orderApi, orderKeys } from './api'
import { localDayStartIso, nextLocalDayStartIso } from './dateFilters'
import { promisedDateInstant, promisedDateKey, promisedDateLabel } from '../../utils/promisedDate'
import type { IntakeCustomer, Order, OrderBag, OrderItemNoteUpdate, OrderItemPayload, OrderListItem, OrderStatus } from './types'
import { OrderBatchComposer } from './OrderBatchComposer'
import { OrderBags } from './BagLabels'

const statusText: Record<OrderStatus, string> = {
  RECEIVED: 'Đã nhận', PROCESSING: 'Đang xử lý', READY: 'Sẵn sàng',
  COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', REOPENED: 'Đã mở lại',
}
const money = (value: number, currency = 'VND') => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2,
}).format(value)
const initials = (value?: string) => (value || 'Khách vãng lai')
  .trim()
  .split(/\s+/)
  .slice(-2)
  .map((part) => part[0]?.toLocaleUpperCase('vi-VN'))
  .join('')
const quantitySummary = (items: Order['items']) => {
  const totals = new Map<Order['items'][number]['unitType'], number>()
  items.forEach(item => totals.set(item.unitType, (totals.get(item.unitType) ?? 0) + item.quantity))
  return [...totals].map(([unit, amount]) => quantityText(amount, unit)).join(' · ')
}
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
  const { notify } = useToast()
  const [tab, setTab] = useState<'ALL' | OrderStatus>('ALL')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [due, setDue] = useState<DueFilter>('')
  const [selected, setSelected] = useState<Map<number, OrderListItem>>(() => new Map())
  const [cancelOrder, setCancelOrder] = useState<OrderListItem>()
  const [cancelReason, setCancelReason] = useState('')
  const canCreate = hasPermission(PERMISSION_CODES.ORDER_CREATE)
  const canCreateBatch = hasPermission(PERMISSION_CODES.BATCH_CREATE)
  const canCancel = hasPermission(PERMISSION_CODES.ORDER_CANCEL)
  const batchMode = canCreateBatch && location.pathname === '/orders/batching'
  const status = tab === 'ALL' ? undefined : tab
  const filterOptions = useQuery({ queryKey: orderKeys.filterOptions(branchId), queryFn: () => orderApi.filterOptions(branchId!), enabled: Boolean(branchId && !batchMode) })
  const query = useQuery({
    queryKey: orderKeys.list(branchId, status, debouncedSearch, page, size, from, to, serviceId ? Number(serviceId) : undefined, due),
    queryFn: () => orderApi.list({ branchId: branchId!, status, search: debouncedSearch || undefined, page, size,
      from: from ? localDayStartIso(from) : undefined,
      to: to ? nextLocalDayStartIso(to) : undefined,
      serviceId: serviceId ? Number(serviceId) : undefined,
      ...dueFilterParams(due) }),
    enabled: Boolean(branchId && !batchMode),
  })
  const totalQuery = useQuery({ queryKey: ['orders', 'total', branchId], queryFn: () => orderApi.list({ branchId: branchId!, page: 0, size: 1 }), enabled: Boolean(branchId && !batchMode) })
  const cancel = useMutation({
    mutationFn: (order: OrderListItem) => orderApi.reasoned(order.id, branchId!, 'cancel', order.version, cancelReason.trim()),
    onSuccess: () => {
      setCancelOrder(undefined); setCancelReason('')
      void queryClient.invalidateQueries({ queryKey: orderKeys.all })
      notify({ message: 'Đã hủy đơn hàng.', tone: 'success' })
    },
    onError: (error) => notify({ message: error instanceof ApiError && error.status === 409 ? 'Đơn vừa được người khác cập nhật. Hãy tải lại và thử lại.' : 'Không thể hủy đơn hàng.', tone: 'error' }),
  })
  useEffect(() => subscribe('order.', () => {
    void queryClient.invalidateQueries({ queryKey: orderKeys.all, refetchType: 'active' })
  }), [queryClient, subscribe])
  useEffect(() => subscribe('realtime.reconnected', () => {
    void queryClient.invalidateQueries({ queryKey: orderKeys.all, refetchType: 'active' })
  }), [queryClient, subscribe])

  const advancedFilterCount = Number(Boolean(from)) + Number(Boolean(to)) + Number(Boolean(serviceId)) + Number(Boolean(due))
  const hasActiveFilters = Boolean(status || debouncedSearch || advancedFilterCount)
  const pageItems = query.data?.items ?? []
  const selectedOnPage = pageItems.filter((order) => selected.has(order.id)).length
  const toggleOrder = (order: OrderListItem, checked: boolean) => setSelected((current) => { const next = new Map(current); if (checked) next.set(order.id, order); else next.delete(order.id); return next })
  const togglePage = (checked: boolean) => setSelected((current) => { const next = new Map(current); pageItems.forEach((order) => { if (checked) next.set(order.id, order); else next.delete(order.id) }); return next })
  const openCancel = (order: OrderListItem) => { setCancelOrder(order); setCancelReason('') }
  const rowActions = (order: OrderListItem) => <div className="operational-row-actions"><ButtonLink className="orders-table__view-button" size="sm" variant="ghost" to={`/orders/${order.id}`}><Eye size={17} />Xem</ButtonLink><ActionMenu label={`Thao tác cho ${order.orderCode}`}><Link role="menuitem" data-tone="view" to={`/orders/${order.id}`}><Eye size={24} aria-hidden="true"/><span className="action-menu__label">Xem chi tiết</span></Link>{canCancel && !['COMPLETED', 'CANCELLED'].includes(order.status) && <button type="button" role="menuitem" data-tone="danger" onClick={() => openCancel(order)}><Trash2 size={24} aria-hidden="true"/><span className="action-menu__label">Hủy đơn</span></button>}</ActionMenu></div>

  if (batchMode) return <div className="page-container orders-page"><header className="orders-heading"><div className="orders-heading__copy"><p className="eyebrow">Điều phối xử lý</p><h1>Ghép mẻ từ đơn hàng</h1><p>Chọn đồ từ nhiều đơn, kiểm tra tính tương thích và yêu cầu trước khi tạo mẻ.</p></div></header><OrderBatchComposer onClose={() => navigate('/orders')} /></div>

  const statusTabs = (['ALL', 'RECEIVED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED', 'REOPENED'] as const).map((value) => ({
    value,
    label: value === 'ALL' ? 'Tất cả' : statusText[value],
    icon: <StatusFilterIcon value={value === 'ALL' ? undefined : value} />,
    tone: value.toLowerCase(),
    count: value === 'ALL' ? totalQuery.data?.totalElements : tab === value ? query.data?.totalElements : undefined,
  }))

  return <div className={`page-container orders-page operational-list-page${selected.size ? ' operational-list-page--selected' : ''}`}>
    <OperationalListShell className="orders-list-shell">
      <OperationalListHeader icon={<ClipboardList size={26}/>} title="Danh sách đơn hàng" subtitle="Quản lý và theo dõi toàn bộ đơn hàng trong hệ thống" totalValue={totalQuery.isLoading ? '—' : `${totalQuery.data?.totalElements ?? 0} đơn hàng`} action={<div className="operational-list__primary-actions">{canCreateBatch && <Button variant="secondary" onClick={() => navigate('/orders/batching')}><Layers3 size={18}/>Ghép mẻ</Button>}{canCreate && <ButtonLink to="/orders/new"><Plus size={18}/>Tạo đơn mới</ButtonLink>}</div>}/>
      <div className="operational-list__controls">
        <div className="operational-list__toolbar">
          <OperationalSearch label="Tìm đơn hàng" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Mã đơn, tên khách, số điện thoại, dịch vụ…" />
          <CollapsibleFilterPanel className="orders-advanced-filters" label="Bộ lọc" activeCount={advancedFilterCount} fieldsClassName="orders-date-fields">
          <Field label="Dịch vụ"><select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setPage(0) }}><option value="">Tất cả dịch vụ</option>{filterOptions.data?.services.map((service) => <option key={service.id} value={service.id}>{service.label}</option>)}</select></Field>
          <Field label="Hạn trả"><select value={due} onChange={(event) => { setDue(event.target.value as DueFilter); setPage(0) }}><option value="">Tất cả hạn trả</option><option value="OVERDUE">Đã quá hạn</option><option value="TODAY">Hẹn trả hôm nay</option><option value="TOMORROW">Hẹn trả ngày mai</option><option value="NEXT_7_DAYS">Trong 7 ngày tới</option><option value="NO_DATE">Chưa hẹn trả</option></select></Field>
          <Field label="Từ ngày"><input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(0) }} /></Field>
          <Field label="Đến ngày"><input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(0) }} /></Field>
          {advancedFilterCount > 0 && <Button variant="ghost" type="button" onClick={() => { setFrom(''); setTo(''); setServiceId(''); setDue(''); setPage(0) }}>Xóa lọc</Button>}
          </CollapsibleFilterPanel>
        </div>
        <OperationalStatusTabs tabs={statusTabs} value={tab} onChange={(value) => { setTab(value); setPage(0) }} label="Trạng thái đơn hàng" />
      </div>
      <BulkActionBar count={selected.size} noun="đơn hàng" onClear={() => setSelected(new Map())}>{canCreateBatch && <Button size="sm" onClick={() => navigate(`/orders/batching?orders=${[...selected.keys()].join(',')}`)}><Layers3 size={17}/>Ghép mẻ</Button>}</BulkActionBar>
      {query.isLoading ? <LoadingState rows={6} /> : query.isError
        ? <ErrorState title="Không tải được đơn hàng" body="Kiểm tra kết nối rồi thử lại." onRetry={() => void query.refetch()} />
        : !query.data?.items.length
          ? <StatePanel className="orders-empty-state" icon={<img className="orders-empty-illustration" src="/images/wash-batches/wash-batches-empty.png" alt="" decoding="async" />} title={debouncedSearch ? `Không tìm thấy kết quả cho “${debouncedSearch}”` : hasActiveFilters ? 'Không có đơn hàng phù hợp' : 'Chưa có đơn hàng'} body={hasActiveFilters ? 'Thử đổi trạng thái, từ khóa hoặc bộ lọc.' : 'Tạo đơn hàng đầu tiên để bắt đầu theo dõi và xử lý.'} action={debouncedSearch ? <Button variant="secondary" onClick={() => setSearch('')}>Xóa tìm kiếm</Button> : canCreate ? <ButtonLink to="/orders/new"><Plus size={18} />Tạo đơn hàng</ButtonLink> : undefined} />
          : <>
            <div className="orders-mobile-list">{query.data.items.map((order) =>
              <article className="order-card" data-selected={selected.has(order.id) || undefined} key={order.id}>
                <div className="order-card__head"><SelectionCheckbox checked={selected.has(order.id)} onChange={(event) => toggleOrder(order, event.target.checked)} label={`Chọn ${order.orderCode}`}/><Link to={`/orders/${order.id}`}>{order.orderCode}</Link><Status value={order.status} /></div>
                <div className="order-card__customer"><span className="order-customer-avatar" aria-hidden="true">{initials(order.customerName)}</span><span><h2>{order.customerName || 'Khách vãng lai'}</h2>{order.customerPhone && <small>{order.customerPhone}</small>}</span></div>
                <p className="order-card__service"><span aria-hidden="true"><Shirt size={17} /></span>{order.serviceSummary || 'Dịch vụ giặt là'}</p>
                <div className="order-card__facts"><span><CalendarDays size={16}/>{order.promisedAt ? promisedDateLabel(order.promisedAt) : 'Chưa hẹn trả'}</span><span><DateTimeText value={order.createdAt} recent /></span></div>
                <div className="order-card__foot"><strong>{money(order.totalAmount, order.currency)}</strong>{rowActions(order)}</div>
              </article>)}</div>
            <div className="orders-table-wrap"><table className="orders-table"><thead><tr>
              <th><SelectionCheckbox checked={Boolean(pageItems.length) && selectedOnPage === pageItems.length} indeterminate={selectedOnPage > 0 && selectedOnPage < pageItems.length} onChange={(event) => togglePage(event.target.checked)} label="Chọn tất cả đơn trên trang này"/></th><th>Mã đơn</th><th>Khách hàng</th><th>Dịch vụ</th><th>Hẹn trả</th><th>Tổng tiền</th><th>Tạo lúc</th><th>Trạng thái</th><th>Thao tác</th>
            </tr></thead><tbody>{query.data.items.map((order) => <tr key={order.id} data-selected={selected.has(order.id) || undefined}>
              <td><SelectionCheckbox checked={selected.has(order.id)} onChange={(event) => toggleOrder(order, event.target.checked)} label={`Chọn ${order.orderCode}`}/></td><td><Link to={`/orders/${order.id}`}>{order.orderCode}</Link></td>
              <td><span className="orders-table__customer"><span className="order-customer-avatar" aria-hidden="true">{initials(order.customerName)}</span><span><strong>{order.customerName || 'Khách vãng lai'}</strong><small>{order.customerPhone}</small></span></span></td>
              <td><span className="orders-table__service"><span aria-hidden="true"><Shirt size={17} /></span>{order.serviceSummary || 'Dịch vụ giặt là'}</span></td><td>{order.promisedAt ? promisedDateLabel(order.promisedAt) : <span className="text-muted">Chưa hẹn</span>}</td><td><strong className="orders-table__amount">{money(order.totalAmount, order.currency)}</strong></td><td><DateTimeText value={order.createdAt} recent /></td><td><Status value={order.status} /></td>
              <td>{rowActions(order)}</td>
            </tr>)}</tbody></table></div>
            <OperationalPagination page={page} size={size} totalElements={query.data.totalElements} totalPages={query.data.totalPages} noun="đơn hàng" onPage={setPage} onSize={(value) => { setSize(value); setPage(0) }}/>
          </>}
    </OperationalListShell>
    <OverlayDialog open={Boolean(cancelOrder)} onClose={() => !cancel.isPending && setCancelOrder(undefined)} title={`Hủy đơn ${cancelOrder?.orderCode ?? ''}?`} description="Đơn đã hủy vẫn được giữ trong lịch sử hệ thống." footer={<><Button variant="secondary" disabled={cancel.isPending} onClick={() => setCancelOrder(undefined)}>Quay lại</Button><Button variant="danger" loading={cancel.isPending} disabled={!cancelReason.trim()} onClick={() => cancelOrder && cancel.mutate(cancelOrder)}>Hủy đơn</Button></>}><Field label="Lý do hủy" required><textarea rows={4} maxLength={500} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} autoFocus/></Field></OverlayDialog>
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
  const { notify } = useToast()
  const [mode, setMode] = useState<'existing' | 'guest'>('existing')
  const [search, setSearch] = useState('')
  const scanInputRef = useRef<HTMLInputElement>(null)
  const scanVersion = useRef(0)
  const submitLock = useRef(false)
  const [scanStatus, setScanStatus] = useState<{ type: 'READY' | 'LOOKING_UP' | 'FOUND_CUSTOMER' | 'WRONG_CODE_TYPE' | 'NOT_FOUND' | 'ERROR'; code?: string }>({ type: 'READY' })
  const [completedOrder, setCompletedOrder] = useState<Order>()
  const [customerId, setCustomerId] = useState<number>()
  const [chosenCustomer, setChosenCustomer] = useState<IntakeCustomer>()
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [promisedDate, setPromisedDate] = useState('')
  const [note, setNote] = useState('')
  const [bagCount, setBagCount] = useState(1)
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

  const scanCustomer = async () => {
    if (!branchId || !search.trim()) return
    const version = ++scanVersion.current
    setScanStatus({ type: 'LOOKING_UP' })
    try {
      const result = await orderApi.scan(branchId, search.trim())
      if (version !== scanVersion.current) return
      if (result.type === 'CUSTOMER' && result.customer) {
        setCustomerId(result.customer.id)
        setChosenCustomer(result.customer)
        setScanStatus({ type: 'FOUND_CUSTOMER', code: result.customer.customerCode })
        setFormError('')
      } else if (result.type === 'BAG') { setCustomerId(undefined); setChosenCustomer(undefined); setScanStatus({ type: 'WRONG_CODE_TYPE', code: result.bagCode }) }
      else { setCustomerId(undefined); setChosenCustomer(undefined); setScanStatus({ type: 'NOT_FOUND' }) }
    } catch (error) {
      if (version !== scanVersion.current) return
      setScanStatus({ type: 'ERROR', code: error instanceof ApiError && error.status === 403 ? 'Không có quyền tra cứu khách.' : undefined })
    }
  }

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
        promisedAt: promisedDate ? promisedDateInstant(promisedDate) : undefined, note: note || undefined, bagCount,
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
      setCompletedOrder(order)
    },
    onError: () => { submitLock.current = false; notify({ message: 'Không thể tạo đơn. Dữ liệu đang nhập vẫn được giữ; hãy kiểm tra và thử lại.', tone: 'error' }) },
  })
  const dirty = Boolean(customerId || guestName || guestPhone || note || promisedDate || createBatchAfterSave || bagCount !== 1 || items.some((item) => item.serviceId))
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty && !completedOrder) event.preventDefault() }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [completedOrder, dirty])
  const confirmLeave = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (create.isPending || (dirty && !window.confirm('Đơn chưa được lưu. Bạn có chắc muốn rời trang?'))) event.preventDefault()
  }
  const selectService = (key: number, serviceId: number) => {
    updateItem(key, { serviceId, itemTypeId: undefined })
    if (serviceId && branchId) void orderApi.eligibility(branchId, serviceId)
      .then((value) => setEligible((current) => ({ ...current, [key]: value })))
      .catch(() => setFormError('Không tải được loại đồ phù hợp. Hãy chọn lại dịch vụ hoặc thử lại.'))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (submitLock.current || create.isPending || completedOrder) return
    if (mode === 'existing' && !customerId) return setFormError('Hãy chọn một khách hàng.')
    if (mode === 'guest' && !guestName.trim() && !guestPhone.trim()) return setFormError('Nhập tên hoặc số điện thoại khách vãng lai.')
    if (!items.every((item) => item.serviceId && item.itemTypeId && item.quantity > 0)) return setFormError('Mỗi dịch vụ phải có loại đồ cụ thể.')
    if (!Number.isInteger(bagCount) || bagCount < 1 || bagCount > 99) return setFormError('Số túi phải là số nguyên từ 1 đến 99.')
    if (formError) return
    submitLock.current = true
    create.mutate()
  }
  const total = Object.values(quotes).reduce((sum, value) => sum + value.finalAmount, 0)
  const customerSummary = mode === 'existing'
    ? chosenCustomer ? { name: chosenCustomer.fullName, phone: chosenCustomer.phone } : undefined
    : (guestName.trim() || guestPhone.trim()) ? { name: guestName.trim() || 'Khách vãng lai', phone: guestPhone.trim() } : undefined
  const validItemCount = items.filter((item) => item.serviceId && item.itemTypeId).length
  const readyToSubmit = Boolean(branchId && customerSummary && Number.isInteger(bagCount) && bagCount >= 1 && bagCount <= 99 && items.every((item) => item.serviceId && item.itemTypeId && item.quantity > 0) && !formError && !create.isPending)

  const nextCustomer = () => {
    scanVersion.current++
    submitLock.current = false
    create.reset()
    setCompletedOrder(undefined)
    setMode('existing'); setSearch(''); setCustomerId(undefined); setChosenCustomer(undefined)
    setGuestName(''); setGuestPhone(''); setPromisedDate(''); setNote(''); setBagCount(1)
    setItems([{ key: Date.now(), serviceId: 0, sharingMode: 'ANY', quantity: 1 }])
    setQuotes({}); setEligible({}); setFormError(''); setCreateBatchAfterSave(false)
    setScanStatus({ type: 'READY' })
    window.setTimeout(() => scanInputRef.current?.focus(), 0)
  }

  if (completedOrder) return <div className="page-container order-intake-success">
    <div className="order-intake-success__intro"><CheckCircle2 size={30} aria-hidden="true" /><div><h1>Đã tạo đơn {completedOrder.orderCode}</h1><p>Đơn đã lưu. Bạn có thể in tem túi rồi tiếp nhận khách tiếp theo.</p></div></div>
    <Surface className="order-intake-success__summary"><strong>{completedOrder.customerName || 'Khách vãng lai'}</strong><span>{completedOrder.items.length} dịch vụ · {quantitySummary(completedOrder.items)} · {completedOrder.bags?.length ?? 0} túi · {money(completedOrder.totalAmount, completedOrder.currency)}</span><span>Hẹn trả: {completedOrder.promisedAt ? promisedDateLabel(completedOrder.promisedAt) : 'Chưa hẹn'}</span></Surface>
    <OrderBags order={completedOrder} onBagUpdated={(bag: OrderBag) => setCompletedOrder(current => current && ({ ...current, bags: current.bags.map(item => item.id === bag.id ? bag : item) }))} />
    <div className="order-intake-success__actions"><ButtonLink to={`/orders/${completedOrder.id}`} variant="secondary">Xem chi tiết đơn</ButtonLink><Button onClick={nextCustomer}><Plus size={18} />Tiếp nhận khách tiếp theo</Button></div>
  </div>

  return <form className="page-container order-create" onSubmit={submit}>
    <nav className="order-breadcrumb" aria-label="Đường dẫn"><Link to="/orders" onClick={confirmLeave}>Đơn hàng</Link><ChevronRight size={15} /><span>Tạo đơn hàng</span></nav>
    <header className="order-create-heading"><div><h1>Tạo đơn hàng</h1><p>Tiếp nhận đơn mới tại quầy</p></div><ButtonLink to="/orders" variant="secondary" onClick={confirmLeave}><ArrowLeft size={18} />Quay lại</ButtonLink></header>
    <ol className="order-steps" aria-label="Tiến trình tạo đơn">
      <li className="active"><span>1</span><div><strong>Khách hàng</strong><small>Chọn hoặc tạo khách hàng</small></div></li>
      <li className={customerSummary ? 'complete' : ''}><span>2</span><div><strong>Dịch vụ</strong><small>Thêm dịch vụ và thông tin</small></div></li>
      <li className={validItemCount ? 'complete' : ''}><span>3</span><div><strong>Hẹn trả</strong><small>Xác nhận và hoàn tất</small></div></li>
    </ol>
    <fieldset className="order-create-fields" disabled={create.isPending}><div className="order-create-grid"><div className="order-form-stack">
      <Surface className="order-section order-section--customer"><div className="section-title"><span>1</span><div><h2>Thông tin khách hàng</h2><p>Quét mã khách hoặc tìm theo tên, số điện thoại.</p></div></div>
        <div className="segmented" role="group" aria-label="Loại khách hàng"><button type="button" aria-pressed={mode === 'existing'} className={mode === 'existing' ? 'active' : ''} onClick={() => { setMode('existing'); setFormError('') }}><UserRound size={17} />Khách hàng có sẵn</button><button type="button" aria-pressed={mode === 'guest'} className={mode === 'guest' ? 'active' : ''} onClick={() => { scanVersion.current++; setMode('guest'); setFormError('') }}><Plus size={17} />Khách vãng lai</button></div>
        {mode === 'existing' ? <><Field label="Quét mã / tìm khách hàng" controlId="order-customer-scan" hint="Quét mã rồi nhấn Enter; cũng có thể tìm theo tên, SĐT hoặc 3–4 số cuối"><div className="order-customer-search"><Search size={18} aria-hidden="true" /><input id="order-customer-scan" ref={scanInputRef} value={search} onChange={(event) => { scanVersion.current++; setSearch(event.target.value); setCustomerId(undefined); setChosenCustomer(undefined); setScanStatus({ type: 'READY' }) }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void scanCustomer() } }} placeholder="Mã KH, tên hoặc số điện thoại" autoComplete="off" /><Button type="button" size="sm" variant="secondary" disabled={!search.trim() || scanStatus.type === 'LOOKING_UP'} onClick={() => void scanCustomer()}>Tra cứu</Button></div></Field>
          <p className={`order-scan-status order-scan-status--${scanStatus.type.toLowerCase()}`} role={scanStatus.type === 'ERROR' || scanStatus.type === 'WRONG_CODE_TYPE' ? 'alert' : 'status'}>{scanStatus.type === 'READY' ? 'Máy quét sẵn sàng' : scanStatus.type === 'LOOKING_UP' ? 'Đang tra cứu mã…' : scanStatus.type === 'FOUND_CUSTOMER' ? `Đã nhận mã ${scanStatus.code}` : scanStatus.type === 'WRONG_CODE_TYPE' ? `Đây là mã túi ${scanStatus.code}, không phải mã khách hàng.` : scanStatus.type === 'NOT_FOUND' ? 'Không tìm thấy khách hàng.' : scanStatus.code || 'Lỗi tra cứu. Thử lại.'}</p>
          {chosenCustomer && <div className="order-selected-customer"><span className="customer-avatar" aria-hidden="true">{initials(chosenCustomer.fullName)}</span><div><strong>{chosenCustomer.fullName}</strong><small>{chosenCustomer.customerCode} · {chosenCustomer.phone || 'Chưa có SĐT'}</small></div><Button type="button" variant="ghost" onClick={() => { scanVersion.current++; setCustomerId(undefined); setChosenCustomer(undefined); setSearch(''); setScanStatus({ type: 'READY' }); scanInputRef.current?.focus() }}>Đổi khách</Button></div>}
          {customers.isFetching && <p className="order-search-status">Đang tìm khách hàng…</p>}
          {customers.isError && <div className="order-search-status" role="alert">Không thể tìm khách hàng. <Button type="button" variant="ghost" onClick={() => void customers.refetch()}>Thử lại</Button></div>}
          {!chosenCustomer && (customers.data?.length ? <div className="customer-results" aria-label="Kết quả khách hàng">{customers.data.map((customer) => <button type="button" key={customer.id} className={`customer-result${customerId === customer.id ? ' selected' : ''}`} onClick={() => { setCustomerId(customer.id); setChosenCustomer(customer); setFormError(''); setScanStatus({ type: 'FOUND_CUSTOMER', code: customer.customerCode }) }}><span className="customer-avatar" aria-hidden="true">{customer.fullName.trim().slice(0, 1).toUpperCase()}</span><span><strong>{customer.fullName}</strong><small>{customer.phone} · {customer.customerCode}</small></span>{customerId === customer.id ? <span className="customer-result__choice"><Check size={18} />Đã chọn</span> : <span className="customer-result__choice">Chọn</span>}</button>)}</div> : search.trim().length >= 2 && !customers.isFetching && !customers.isError && scanStatus.type === 'READY' ? <p className="order-search-status">Không tìm thấy khách hàng phù hợp.</p> : null)}</>
          : <><div className="form-grid"><Field label="Tên khách"><input value={guestName} onChange={(event) => { setGuestName(event.target.value); setFormError('') }} maxLength={150} placeholder="Nhập tên khách hàng" /></Field><Field label="Số điện thoại"><input type="tel" inputMode="tel" value={guestPhone} onChange={(event) => { setGuestPhone(event.target.value); setFormError('') }} maxLength={30} placeholder="Nhập số điện thoại" /></Field></div><p className="field-hint">Thông tin này chỉ được lưu trên đơn hàng, không tự tạo hồ sơ khách hàng.</p></>}
        {mode === 'existing' && hasPermission(PERMISSION_CODES.CUSTOMER_CREATE) && <Button type="button" variant="secondary" onClick={() => setQuickCustomerOpen(true)}><Plus size={18} />Tạo nhanh khách hàng</Button>}
      </Surface>
      <Surface className="order-section order-section--services"><div className="section-title"><span>2</span><div><h2>Dịch vụ</h2><p>Thêm dịch vụ vào đơn hàng, giá sẽ được tính tự động.</p></div></div>
        {services.isLoading && <p className="order-search-status" role="status">Đang tải dịch vụ…</p>}
        {services.isError && <ErrorState title="Không tải được dịch vụ" body="Kiểm tra kết nối rồi thử lại." onRetry={() => void services.refetch()} />}
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
      <Surface className="order-section order-section--promise"><div className="section-title"><span>3</span><div><h2>Túi đồ và hẹn trả</h2><p>Ghi nhận số túi vật lý và thông tin hoàn tất đơn.</p></div></div><Field label="Số túi" controlId="order-bag-count-input" required hint="Mỗi túi sẽ có mã riêng; từ 1 đến 99 túi."><div className="order-bag-count"><button type="button" aria-label="Giảm số túi" disabled={bagCount <= 1} onClick={() => setBagCount(current => Math.max(1, current - 1))}>−</button><input id="order-bag-count-input" type="number" min="1" max="99" step="1" inputMode="numeric" value={bagCount} onChange={(event) => setBagCount(event.target.value === '' ? 0 : Number(event.target.value))} /><button type="button" aria-label="Tăng số túi" disabled={bagCount >= 99} onClick={() => setBagCount(current => Math.min(99, current + 1))}>+</button></div></Field><div className="form-grid"><DatePickerField label="Ngày hẹn trả" value={promisedDate} onChange={setPromisedDate} hint="Không cần chọn giờ." /><Field label="Ghi chú" hint={`${note.length}/2000`}><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={2} placeholder="Ghi chú thêm…" /></Field></div>
        {canCreateBatch && <label className="order-create-batch-choice"><input type="checkbox" checked={shouldCreateBatch} disabled={hasPrivateLoad} onChange={(event) => setCreateBatchAfterSave(event.target.checked)} /><span className="order-create-batch-choice__icon"><Layers3 size={20} /></span><span><strong>{hasPrivateLoad ? 'Tự tạo mẻ nháp riêng' : 'Tạo mẻ nháp riêng sau khi lưu'}</strong><small>{hasPrivateLoad ? 'Đơn có yêu cầu giặt riêng nên hệ thống sẽ tự tạo mẻ.' : `Không cần chuyển sang trang Mẻ giặt để tạo lại${serviceGroupCount > 1 ? `; hệ thống sẽ tách thành ${serviceGroupCount} mẻ theo dịch vụ` : ''}.`}</small></span></label>}
      </Surface>
    </div><Surface as="aside" className="order-summary"><div className="order-summary__head"><span><ClipboardList size={21} /></span><div><h2>Tóm tắt đơn hàng</h2><p>Thông tin đơn sẽ được cập nhật tự động.</p></div></div><div className="order-summary__body"><section><div className="order-summary__label"><span><UserRound size={18} /></span><strong>Khách hàng</strong></div>{customerSummary ? <div className="order-summary__selection"><strong>{customerSummary.name}</strong><small>{customerSummary.phone || 'Không có số điện thoại'}</small></div> : <div className="order-summary__placeholder"><strong>Chưa chọn khách hàng</strong><small>Vui lòng chọn hoặc nhập khách hàng.</small></div>}</section><section><div className="order-summary__label"><span><ShoppingBag size={18} /></span><strong>Dịch vụ</strong></div>{validItemCount ? <div className="order-summary__services">{items.filter((item) => item.serviceId && item.itemTypeId).map((item) => <div key={item.key}><span>{services.data?.find((service) => service.id === item.serviceId)?.nameVi ?? 'Dịch vụ'}</span><strong>{quotes[item.key] ? money(quotes[item.key].finalAmount, quotes[item.key].currency) : 'Đang tính…'}</strong></div>)}</div> : <div className="order-summary__placeholder"><strong>Chưa có dịch vụ</strong><small>Thêm dịch vụ để xem chi tiết.</small></div>}</section><dl><div><dt>Số dịch vụ</dt><dd>{validItemCount}</dd></div><div><dt>Số túi</dt><dd>{bagCount}</dd></div><div><dt>Tạm tính</dt><dd>{money(total, Object.values(quotes)[0]?.currency)}</dd></div><div><dt>Giảm giá</dt><dd>{money(0)}</dd></div><div><dt>Phụ phí</dt><dd>{money(0)}</dd></div><div className="order-summary__total"><dt>Tổng cộng</dt><dd>{money(total, Object.values(quotes)[0]?.currency)}</dd></div></dl><p className="order-summary__note">Giá cuối cùng được hệ thống tính lại khi lưu đơn.</p><Button type="submit" size="lg" loading={create.isPending} disabled={!readyToSubmit}>Xác nhận đơn</Button></div></Surface></div></fieldset>
    {create.error && <p className="order-create-submit-error form-error" role="alert">{create.error instanceof ApiError ? create.error.message : 'Không thể tạo đơn.'}</p>}
    <div className="mobile-order-action"><span><small>Tổng tạm tính</small><strong>{money(total, Object.values(quotes)[0]?.currency)}</strong></span><Button type="submit" loading={create.isPending} disabled={!readyToSubmit}>Tạo đơn</Button></div>
    <QuickCustomerDialog open={quickCustomerOpen} onClose={() => setQuickCustomerOpen(false)} onCreated={(customer) => { scanVersion.current++; setCustomerId(customer.id); setChosenCustomer(customer); setSearch(customer.customerCode); setScanStatus({ type: 'FOUND_CUSTOMER', code: customer.customerCode }) }} />
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
  COMPLETED: 'Hoàn tất đơn hàng', CANCELLED: 'Hủy đơn hàng', REOPENED: 'Mở lại đơn hàng', LABEL_PRINT_REQUESTED: 'Yêu cầu in tem túi',
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

function snapshotUnitPrice(item: Order['items'][number]) {
  const value = item.pricingSnapshot?.unitPriceSnapshot
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function OrderDetailLoading() {
  return <div className="page-container order-detail order-detail--loading" aria-busy="true" aria-label="Đang tải chi tiết đơn hàng">
    <div className="order-detail-header"><LoadingState rows={1} /></div>
    <div className="order-detail-loading-grid"><Surface><LoadingState rows={3} /></Surface><Surface><LoadingState rows={2} /></Surface></div>
  </div>
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
  if (order.isLoading) return <OrderDetailLoading />
  if (order.isError || !order.data) return <div className="page-container"><ErrorState title="Không tải được đơn hàng" body="Đơn không tồn tại hoặc nằm ngoài chi nhánh của bạn." onRetry={() => void order.refetch()} /></div>
  const value = order.data
  const action = nextAction(value)
  const canEdit = (['RECEIVED', 'PROCESSING', 'READY'] as OrderStatus[]).includes(value.status) && hasPermission(PERMISSION_CODES.ORDER_UPDATE)
  const execute = (name: string) => {
    if (name === 'cancel' || name === 'reopen') {
      setReason('')
      setReasonAction(name)
    } else mutate.mutate({ action: name })
  }
  return <div className="page-container order-detail">
    <header className="order-detail-header">
      <div className="order-detail-header__identity">
        <Link className="order-detail-back" to="/orders"><ArrowLeft size={18} aria-hidden="true" />Danh sách đơn hàng</Link>
        <div className="order-detail-header__title"><h1>{value.orderCode}</h1><Status value={value.status} /></div>
        <p>Nhận lúc <DateTimeText value={value.createdAt} /> <span aria-hidden="true">•</span> {value.branchCode}</p>
      </div>
      <div className="order-detail-actions" aria-label="Thao tác đơn hàng">
        {canEdit && <Button className="order-detail-action--edit" variant="secondary" onClick={() => setEditing(current => !current)}><Pencil size={17} aria-hidden="true" />{editing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa'}</Button>}
        {action && hasPermission(action[2]) && <Button className="order-detail-action--primary" loading={mutate.isPending} onClick={() => execute(action[0])}><PackageCheck size={18} aria-hidden="true" />{action[1]}</Button>}
        {(['RECEIVED', 'PROCESSING', 'READY'] as OrderStatus[]).includes(value.status) && hasPermission(PERMISSION_CODES.ORDER_CANCEL) && <Button className="order-detail-action--danger" variant="danger" onClick={() => execute('cancel')}><Trash2 size={17} aria-hidden="true" />Hủy đơn</Button>}
        {value.status === 'COMPLETED' && hasPermission(PERMISSION_CODES.ORDER_REOPEN) && <Button className="order-detail-action--reopen" variant="secondary" onClick={() => execute('reopen')}><RotateCcw size={18} aria-hidden="true" />Mở lại</Button>}
      </div>
    </header>

    {editing && <OrderEditPanel order={value} onClose={() => setEditing(false)} onSaved={updated => { queryClient.setQueryData(orderKeys.detail(id), updated); void history.refetch(); void queryClient.invalidateQueries({ queryKey: orderKeys.all }); setEditing(false) }} />}

    <div className="order-detail-grid">
      <main className="order-detail-main">
        <Surface as="section" className="order-section order-detail-general">
          <DetailSectionTitle className="order-detail-section-title" icon={<ClipboardList size={19} />} title="Thông tin chung" />
          <dl className="detail-facts">
            <div><span className="detail-fact__icon"><UserRound size={20} aria-hidden="true" /></span><span><dt>Khách hàng</dt><dd>{value.customerName || 'Khách vãng lai'}{value.customerPhone && <small>{value.customerPhone}</small>}</dd></span></div>
            <div><span className="detail-fact__icon"><CalendarDays size={20} aria-hidden="true" /></span><span><dt>Ngày hẹn trả</dt><dd className={!value.promisedAt ? 'detail-fact__empty' : undefined}>{value.promisedAt ? promisedDateLabel(value.promisedAt) : 'Chưa hẹn'}</dd></span>{canEdit && <Button className="detail-fact__action" size="sm" variant="ghost" aria-label="Cập nhật ngày hẹn trả" onClick={() => setEditing(true)}><Pencil size={16} aria-hidden="true" /></Button>}</div>
            <div><span className="detail-fact__icon"><UserRoundCheck size={20} aria-hidden="true" /></span><span><dt>Nhân viên nhận</dt><dd>{value.createdBy.displayName}</dd></span></div>
            <div><span className="detail-fact__icon"><Clock3 size={20} aria-hidden="true" /></span><span><dt>Cập nhật cuối</dt><dd><DateTimeText value={value.updatedAt} /></dd></span></div>
          </dl>
        </Surface>

        <Surface as="section" className="order-section order-detail-services">
          <DetailSectionTitle className="order-detail-section-title" icon={<Layers3 size={19} />} title={<>Dịch vụ <span className="order-detail-count">{value.items.length}</span></>} />
          {value.items.length ? <div className="order-services-table-wrap"><table className="order-services-table">
            <caption className="sr-only">Danh sách dịch vụ của đơn hàng</caption>
            <thead><tr><th scope="col">#</th><th scope="col">Dịch vụ</th><th scope="col">Mô tả</th><th scope="col">Số lượng</th><th scope="col">Đơn giá</th><th scope="col">Thành tiền</th></tr></thead>
            <tbody>{value.items.map((item, index) => {
              const unitPrice = snapshotUnitPrice(item)
              return <tr key={item.id}>
                <td data-label="#">{index + 1}</td>
                <td data-label="Dịch vụ"><span className="order-service-name"><span aria-hidden="true"><Shirt size={18} /></span><strong>{item.serviceName}</strong></span></td>
                <td data-label="Mô tả"><span className="order-service-description">{item.itemTypeName}{item.note && <small className="detail-order-item__note"><strong>Ghi chú:</strong> {item.note}</small>}</span></td>
                <td data-label="Số lượng">{quantityText(item.quantity, item.unitType)}</td>
                <td data-label="Đơn giá">{unitPrice === undefined ? '—' : money(unitPrice, value.currency)}</td>
                <td data-label="Thành tiền"><strong>{money(item.lineAmount, value.currency)}</strong></td>
              </tr>
            })}</tbody>
          </table></div> : <StatePanel compact title="Chưa có dịch vụ" body="Đơn hàng này chưa có dịch vụ nào." />}
        </Surface>

        <OrderBags order={value} onBagUpdated={bag => { queryClient.setQueryData<Order>(orderKeys.detail(id), current => current && ({ ...current, bags: current.bags.map(item => item.id === bag.id ? bag : item) })); if (canAudit) void history.refetch() }} />

        <Surface as="section" className="order-section order-detail-note">
          <DetailSectionTitle className="order-detail-section-title" icon={<FileText size={19} />} title="Ghi chú" action={canEdit ? <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil size={16} aria-hidden="true" />Chỉnh sửa ghi chú</Button> : undefined} />
          {value.note ? <p>{value.note}</p> : <p className="order-detail-empty-copy">Chưa có ghi chú cho đơn hàng này.</p>}
        </Surface>
      </main>

      <aside className="order-detail-side">
        <Surface as="section" className="order-total">
          <span className="order-total__label"><WalletCards size={20} aria-hidden="true" />Tổng tiền thanh toán</span>
          <strong>{money(value.totalAmount, value.currency)}</strong>
        </Surface>

        {canReadBatches && <Surface as="section" className="order-batch-references">
          <DetailSectionTitle className="order-detail-section-title" icon={<WashingMachine size={19} />} title="Mẻ giặt liên quan" />
          {batchReferences.isLoading ? <LoadingState rows={2} /> : batchReferences.isError ? <ErrorState title="Không tải được mẻ giặt" body="Thông tin đơn vẫn an toàn. Hãy thử tải lại phần này." onRetry={() => void batchReferences.refetch()} /> : batchReferences.data?.length ? <div className="order-batch-reference-list">{batchReferences.data.map(batch => <Link key={batch.id} to={`/wash-batches/${batch.id}`}><span className="order-batch-reference__icon" aria-hidden="true"><WashingMachine size={18} /></span><span className="order-batch-reference__copy"><strong>{batch.batchCode}</strong><small>{batch.serviceName}</small></span><BatchStatusChip status={batch.status} /><ChevronRight size={18} aria-hidden="true" /></Link>)}</div> : <p className="order-detail-empty-copy">Đơn chưa được xếp vào mẻ giặt.</p>}
        </Surface>}

        {canAudit && <Surface as="section" className="order-history">
          <DetailSectionTitle className="order-detail-section-title" icon={<Clock3 size={19} />} title="Lịch sử đơn hàng" />
          {history.isLoading ? <LoadingState rows={3} /> : history.isError ? <ErrorState title="Không tải được lịch sử" body="Thử tải lại để xem thay đổi của đơn." onRetry={() => void history.refetch()} /> : history.data?.length ? <div className="order-history__timeline">{history.data.map((item) => <article key={item.id}><span className="history-dot"><Clock3 size={14} aria-hidden="true" /></span><div><strong>{historyLabel(item.action, item.changedFields)}</strong><p>{item.actor.displayName} <span aria-hidden="true">•</span> <DateTimeText value={item.createdAt} /></p><HistoryDetails changed={item.changedFields} currency={value.currency} />{item.reason && <small>{item.reason}</small>}</div></article>)}</div> : <p className="order-detail-empty-copy">Chưa có sự kiện lịch sử.</p>}
        </Surface>}
      </aside>
    </div>

    <OverlayDialog open={reasonAction !== null} onClose={() => !mutate.isPending && setReasonAction(null)} title={reasonAction === 'cancel' ? 'Hủy đơn hàng' : 'Mở lại đơn hàng'} description="Lý do sẽ được lưu trong lịch sử kiểm toán." footer={<><Button variant="secondary" onClick={() => setReasonAction(null)} disabled={mutate.isPending}>Đóng</Button><Button variant={reasonAction === 'cancel' ? 'danger' : 'primary'} loading={mutate.isPending} disabled={!reason.trim()} onClick={() => reasonAction && mutate.mutate({ action: reasonAction, reason: reason.trim() })}>{reasonAction === 'cancel' ? 'Xác nhận hủy' : 'Xác nhận mở lại'}</Button></>}><Field label="Lý do" required><textarea rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} autoFocus /></Field></OverlayDialog>
  </div>
}
