import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, PackageSearch, Plus, Printer, RotateCcw, ScanLine, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { Field } from '../../components/Field'
import { OverlayDialog } from '../../components/OverlayDialog'
import { ErrorState, LoadingState, StatePanel } from '../../components/States'
import { OperationalPagination, OperationalSearch } from '../../components/operational-list/OperationalList'
import { useDebouncedValue } from '../../components/operational-list/useDebouncedValue'
import { Button, ButtonLink } from '../../components/ui/Button'
import { CollapsibleFilterPanel } from '../../components/ui/CollapsibleFilterPanel'
import { DateTimeText } from '../../components/ui/DateTimeText'
import { StatCard } from '../../components/ui/StatCard'
import { Surface } from '../../components/ui/Surface'
import { useToast } from '../../providers/ToastProvider'
import { useRealtime } from '../../realtime/context'
import { sortingApi, sortingKeys } from './api'
import { openGroupLabelSession } from './GroupLabels'
import { amount, cares, careText, colors, colorText, detergents, drying, hygiene, softeners, temperatures, unit, washes, washText } from './labels'
import type { BagContext, ColorGroup, DryingInstruction, FabricCare, GroupDraft, ProcessingGroup, SortingItem, WashMode } from './types'

type DraftState = Omit<GroupDraft, 'dryingInstruction'> & { localId:number; quantityText:string; dryingInstruction:DryingInstruction|'' }
function thousand(value:number) { return Math.round(value * 1000) }
function makeDraft(item:SortingItem, localId:number):DraftState {
  return { localId, orderItemId:item.id, quantity:Math.max(0,item.remainingQuantity), quantityText:String(Math.max(0,item.remainingQuantity)), colorGroup:'UNKNOWN', fabricCare:'UNKNOWN',
    washMode:'SERVICE_DEFAULT', temperatureProfile:'SERVICE_DEFAULT', detergentProfile:'DEFAULT',
    softenerProfile:'DEFAULT', hygieneLevel:'STANDARD', separateWash:item.requiresSeparateWash, dryingInstruction:'', note:'' }
}
function toPayload(draft:DraftState):GroupDraft {
  return { orderItemId:draft.orderItemId,quantity:draft.quantity,colorGroup:draft.colorGroup,
    fabricCare:draft.fabricCare,washMode:draft.washMode,temperatureProfile:draft.temperatureProfile,
    detergentProfile:draft.detergentProfile,softenerProfile:draft.softenerProfile,
    hygieneLevel:draft.hygieneLevel,separateWash:draft.separateWash,
    dryingInstruction:draft.dryingInstruction as DryingInstruction,note:draft.note }
}
function errorText(error:unknown) {
  if (!(error instanceof ApiError)) return 'Không thể kết nối. Kiểm tra mạng rồi thử lại.'
  if (error.status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (error.status === 409) return 'Túi vừa được nhân viên khác cập nhật. Bản nháp được giữ lại; hãy tải lại dữ liệu.'
  if (error.problem.errorCode === 'SORTING_BAG_NOT_ELIGIBLE') return 'Túi hoặc đơn không còn đủ điều kiện phân loại. Hãy tra cứu lại.'
  return error.problem.detail || 'Không thể hoàn tất thao tác. Bản nháp vẫn được giữ lại.'
}

function GroupEditor({ draft, items, disabled, onChange, onRemove, index }: {
  draft:DraftState;items:SortingItem[];disabled:boolean;onChange:(draft:DraftState)=>void;onRemove:()=>void;index:number
}) {
  const item = items.find(value => value.id === draft.orderItemId)!
  const change = (update:Partial<DraftState>) => onChange({ ...draft, ...update })
  return <Surface as="article" className="sorting-group-card">
    <header><div><span className="sorting-kicker">Nhóm nháp {index + 1}</span><h3>{item.serviceName}</h3><p>{item.itemTypeName}</p></div><Button type="button" variant="ghost" disabled={disabled} onClick={onRemove} aria-label={`Xóa nhóm nháp ${index + 1}`}><Trash2 size={18}/>Xóa</Button></header>
    <div className="sorting-editor-grid">
      <Field label="Dịch vụ / loại đồ" required><select value={draft.orderItemId} disabled={disabled} onChange={event => {
        const next = items.find(value => value.id === Number(event.target.value))!
        change({ orderItemId:next.id, quantity:next.remainingQuantity, quantityText:String(next.remainingQuantity), separateWash:next.requiresSeparateWash })
      }}>{items.map(value => <option key={value.id} value={value.id}>{value.serviceName} · {value.itemTypeName}</option>)}</select></Field>
      <Field label={`Số lượng / khối lượng (${unit(item.unitType)})`} required error={!/^\d+(?:[.,]\d{0,3})?$/.test(draft.quantityText) || draft.quantity <= 0 ? 'Nhập số lượng lớn hơn 0, tối đa 3 chữ số thập phân.' : undefined}><input inputMode="decimal" value={draft.quantityText} disabled={disabled} onChange={event => change({ quantityText:event.target.value, quantity:Number(event.target.value.replace(',','.')) || 0 })} /></Field>
      <fieldset className="sorting-colors"><legend>Màu *</legend><div className="sorting-chips">{colors.map(([value,label]) => <button key={value} type="button" disabled={disabled} className={draft.colorGroup === value ? 'is-selected' : ''} aria-pressed={draft.colorGroup === value} onClick={() => change({ colorGroup:value })}>{label}</button>)}</div></fieldset>
      <Field label="Chất liệu / mức chăm sóc" required><select value={draft.fabricCare} disabled={disabled} onChange={event => change({ fabricCare:event.target.value as FabricCare })}>{cares.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Chế độ giặt" required><select value={draft.washMode} disabled={disabled} onChange={event => change({ washMode:event.target.value as WashMode })}>{washes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Hướng dẫn sấy" required error={!draft.dryingInstruction ? 'Chọn cách xử lý sau giặt.' : undefined}><select value={draft.dryingInstruction} disabled={disabled} onChange={event => change({ dryingInstruction:event.target.value as DryingInstruction })}><option value="">Chọn cách xử lý</option>{drying.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <label className="sorting-separate"><input type="checkbox" checked={draft.separateWash} disabled={disabled || item.requiresSeparateWash} onChange={event => change({ separateWash:event.target.checked })}/><span><strong>Giặt riêng</strong><small>{item.requiresSeparateWash ? 'Đơn hoặc loại đồ này bắt buộc giặt riêng.' : 'Bật nếu không được ghép với nhóm khác.'}</small></span></label>
    </div>
    <details className="sorting-advanced"><summary>Yêu cầu xử lý</summary><div className="sorting-editor-grid">
      <Field label="Nhiệt độ"><select value={draft.temperatureProfile} disabled={disabled} onChange={event => change({ temperatureProfile:event.target.value as GroupDraft['temperatureProfile'] })}>{temperatures.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Chất giặt"><select value={draft.detergentProfile} disabled={disabled} onChange={event => change({ detergentProfile:event.target.value as GroupDraft['detergentProfile'] })}>{detergents.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Nước xả"><select value={draft.softenerProfile} disabled={disabled} onChange={event => change({ softenerProfile:event.target.value as GroupDraft['softenerProfile'] })}>{softeners.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Mức vệ sinh"><select value={draft.hygieneLevel} disabled={disabled} onChange={event => change({ hygieneLevel:event.target.value as GroupDraft['hygieneLevel'] })}>{hygiene.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Ghi chú"><textarea rows={3} maxLength={1000} value={draft.note} disabled={disabled} onChange={event => change({ note:event.target.value })}/></Field>
    </div></details>
  </Surface>
}

export function SortingPage() {
  const { branchId, hasPermission } = useAuth()
  const { notify } = useToast()
  const { subscribe } = useRealtime()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const lock = useRef(false)
  const nextId = useRef(1)
  const [code,setCode] = useState('')
  const [context,setContext] = useState<BagContext|null>(null)
  const [drafts,setDrafts] = useState<DraftState[]>([])
  const [scanState,setScanState] = useState<'READY'|'LOOKING_UP'|'FOUND'|'NOT_FOUND'|'ERROR'>('READY')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [success,setSuccess] = useState(false)
  const [stale,setStale] = useState(false)
  const [reopenOpen,setReopenOpen] = useState(false)
  const [reason,setReason] = useState('')
  const [printing,setPrinting] = useState(false)
  useEffect(() => {
    if (!drafts.length) return
    const warn = (event:BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  },[drafts.length])
  useEffect(() => { setContext(null);setDrafts([]);setScanState('READY');setSuccess(false);setCode('') },[branchId])
  useEffect(() => subscribe('sorting.', event => {
    if (context && event.entityId === context.bagId && (event.version ?? 0) > context.bagVersion && !busy) setStale(true)
    void queryClient.invalidateQueries({queryKey:sortingKeys.all})
  }),[subscribe,context,busy,queryClient])

  const scan = async () => {
    if (!branchId || !code.trim() || lock.current) return
    if (drafts.length && context && code.trim().toUpperCase() !== context.bagCode.toUpperCase()
      && !window.confirm('Bản nháp phân loại chưa được lưu. Bỏ bản nháp và tra cứu túi khác?')) return
    lock.current = true;setScanState('LOOKING_UP');setError('');setSuccess(false)
    try {
      const found = await sortingApi.scan(branchId,code.trim())
      setContext(found)
      setDrafts(current => context?.bagId === found.bagId
        ? current.filter(draft => found.items.some(item => item.id === draft.orderItemId)) : [])
      setStale(false);setScanState('FOUND')
    } catch (value) {
      if (!context) setContext(null)
      setScanState(value instanceof ApiError && value.status === 404 ? 'NOT_FOUND' : 'ERROR')
      setError(value instanceof ApiError && value.status === 404 ? 'Không tìm thấy túi trong chi nhánh này.' : errorText(value))
    } finally { lock.current = false }
  }
  const nextBag = () => { setContext(null);setDrafts([]);setCode('');setScanState('READY');setError('');setSuccess(false);setStale(false);requestAnimationFrame(() => inputRef.current?.focus()) }
  const addGroup = () => {
    if (!context || busy) return
    const available = context.items.find(item => thousand(item.remainingQuantity) > drafts.filter(d => d.orderItemId === item.id).reduce((sum,d) => sum + thousand(d.quantity),0))
    const item = available ?? context.items[0]
    if (item) setDrafts(current => [...current,makeDraft(item,nextId.current++)])
  }
  const remaining = (item:SortingItem) => thousand(item.remainingQuantity) - drafts.filter(d => d.orderItemId === item.id).reduce((sum,d) => sum + thousand(d.quantity),0)
  const invalid = !drafts.length || drafts.some(d => !/^\d+(?:[.,]\d{0,3})?$/.test(d.quantityText) || !d.quantity || thousand(d.quantity) <= 0 || !d.dryingInstruction || !Number.isFinite(d.quantity) || Math.abs(d.quantity*1000-Math.round(d.quantity*1000))>0.00001)
    || Boolean(context?.items.some(item => remaining(item) < 0 || (context.lastUnsortedBag && remaining(item) !== 0)))
  const confirm = async () => {
    if (!branchId || !context || invalid || lock.current || stale) return
    lock.current = true;setBusy(true);setError('')
    try {
      const updated = await sortingApi.confirm(branchId,context.bagId,context.bagVersion,drafts.map(toPayload))
      setContext(updated);setSuccess(true);setDrafts([]);setStale(false)
      notify({message:`Đã tạo ${updated.groups.filter(group => group.status === 'WAITING').length} nhóm đồ.`,tone:'success'})
    } catch (value) { setError(errorText(value));if (value instanceof ApiError && value.status === 409) setStale(true) }
    finally { lock.current = false;setBusy(false) }
  }
  const reopen = async () => {
    if (!branchId || !context || !reason.trim() || lock.current) return
    lock.current = true;setBusy(true);setError('')
    try {
      const updated = await sortingApi.reopen(branchId,context.bagId,context.bagVersion,reason.trim())
      setContext(updated);setSuccess(false);setReopenOpen(false);setReason('');setStale(false)
      notify({message:'Đã mở lại phân loại. Nhóm cũ được giữ trong lịch sử.',tone:'success'})
    } catch (value) { setError(errorText(value));if (value instanceof ApiError && value.status === 409) setStale(true) }
    finally { lock.current = false;setBusy(false) }
  }
  const print = async (requested:ProcessingGroup[]) => {
    if (!branchId || printing) return
    const session = openGroupLabelSession()
    if (!session) { notify({message:'Trình duyệt đã chặn cửa sổ in.',tone:'error'});return }
    setPrinting(true)
    const results = await Promise.allSettled(requested.filter(group => group.status === 'WAITING').map(group => sortingApi.print(branchId,group.id)))
    const ready = results.filter((result):result is PromiseFulfilledResult<ProcessingGroup> => result.status === 'fulfilled').map(result => result.value)
    try {
      if (ready.length) { session.submit(ready);notify({message:`Đã gửi yêu cầu in ${ready.length} tem. Kiểm tra máy in.`,tone:'success'}) }
      else session.close()
    } catch { session.close();notify({message:'Không thể mở hộp thoại in. Hãy thử lại.',tone:'error'}) }
    if (results.some(result => result.status === 'rejected')) notify({message:'Có tem chưa gửi được yêu cầu in.',tone:'error'})
    setPrinting(false)
  }
  const validBag = context?.bagStatus === 'RECEIVED' && context.orderStatus === 'RECEIVED'
  const waitingGroups = context?.groups.filter(group => group.status === 'WAITING') ?? []
  return <div className="page-container sorting-page">
    <header className="sorting-page__header"><ButtonLink to="/orders" variant="ghost" onClick={event => { if (drafts.length && !window.confirm('Bản nháp phân loại chưa được lưu. Rời màn hình?')) event.preventDefault() }}><ArrowLeft size={18}/>Quay lại</ButtonLink><div><span className="sorting-kicker">Vận hành</span><h1>Phân loại đồ</h1><p>Quét túi đã nhận, chia nhóm và đối soát trước khi đưa vào hàng chờ.</p></div></header>
    <Surface as="section" className="sorting-scan"><div className="sorting-scan__title"><ScanLine size={24}/><div><h2>Quét mã túi / nhập mã túi</h2><p role="status">{scanState === 'LOOKING_UP' ? 'Đang tra cứu…' : 'Máy quét sẵn sàng · quét rồi nhấn Enter'}</p></div></div><div className="sorting-scan__form"><Field label="Mã túi"><input ref={inputRef} value={code} onChange={event => setCode(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault();void scan() } }} placeholder="Ví dụ: GS-00125-01 hoặc B123" autoComplete="off" disabled={busy}/></Field><Button type="button" loading={scanState === 'LOOKING_UP'} disabled={!code.trim() || busy} onClick={() => void scan()}>Tra cứu</Button></div></Surface>
    {error && <p className="sorting-error" role="alert"><AlertTriangle size={18}/>{error}</p>}
    {stale && <div className="sorting-error" role="alert"><AlertTriangle size={18}/>Túi vừa được cập nhật ở nơi khác. Bản nháp đang được giữ lại.<Button type="button" variant="secondary" onClick={() => void scan()}>Tải lại túi</Button></div>}
    {!context && scanState === 'READY' && <StatePanel title="Sẵn sàng phân loại" body="Quét tem túi đồ hoặc nhập mã túi để bắt đầu." icon={<ScanLine/>}/>}
    {!context && (scanState === 'NOT_FOUND' || scanState === 'ERROR') && <StatePanel title={scanState === 'NOT_FOUND' ? 'Không tìm thấy túi' : 'Không tra cứu được túi'} body="Kiểm tra mã hoặc chi nhánh rồi thử lại." icon={<PackageSearch/>}/>}
      {context && <div className="sorting-layout"><main className="sorting-work">
      <Surface as="section" className="sorting-context"><div><span className="sorting-kicker">Túi đồ · {context.bagSequence}/{context.activeBagCount}</span><h2>{context.bagCode}</h2><p>{context.customerName || 'Khách vãng lai'} · Đơn {context.orderCode}</p></div><div><small>Nhận lúc <DateTimeText value={context.bagCreatedAt}/></small>{context.promisedAt && <small>Hẹn trả <DateTimeText value={context.promisedAt}/></small>}</div></Surface>
      {!validBag && <Surface className="sorting-warning" role="alert"><AlertTriangle size={20}/><div><strong>{context.bagStatus === 'VOIDED' ? 'Túi này đã bị hủy.' : context.bagStatus === 'LEGACY_UNVERIFIED' ? 'Đơn lịch sử này chưa xác minh túi thực tế.' : context.bagStatus === 'SORTED' ? 'Túi đã được phân loại.' : 'Đơn không còn ở trạng thái có thể phân loại.'}</strong>{context.bagVoidReason && <p>Lý do: {context.bagVoidReason}</p>}</div></Surface>}
      {context.bagStatus === 'SORTED' && !success && <Surface as="section" className="sorting-existing"><div className="sorting-section-heading"><h2>Nhóm đồ đã tạo</h2>{hasPermission(PERMISSION_CODES.SORTING_PROCESS) && context.orderStatus === 'RECEIVED' && <Button variant="secondary" disabled={busy || stale} onClick={() => setReopenOpen(true)}><RotateCcw size={18}/>Phân loại lại</Button>}</div>{context.groups.map(group => <GroupRow key={group.id} group={group} onPrint={() => void print([group])} printing={printing}/>)}</Surface>}
      {validBag && !success && <><Surface as="section" className="sorting-items"><h2>Dịch vụ trong đơn</h2>{context.items.map(item => <div key={item.id} className="sorting-item"><div><strong>{item.serviceName} · {item.itemTypeName}</strong><small>{item.sharingMode === 'PRIVATE_LOAD' ? 'Tải riêng bắt buộc' : item.requiresSeparateWash ? 'Loại đồ yêu cầu giặt riêng' : 'Có thể ghép khi phù hợp'}</small></div><div><strong>{amount(item.quantity)} {unit(item.unitType)}</strong><small>Đã phân loại {amount(item.alreadyAllocatedQuantity)} · Còn {amount(Math.max(0,remaining(item)/1000))}</small></div></div>)}</Surface><div className="sorting-section-heading"><h2>Nhóm đồ ({drafts.length})</h2><Button type="button" variant="secondary" disabled={busy || stale} onClick={addGroup}><Plus size={18}/>Thêm nhóm đồ</Button></div>{!drafts.length && <StatePanel compact title="Chưa có nhóm đồ" body="Thêm nhóm để phân bổ đồ từ túi này. Chưa có bản ghi nào được lưu."/>}{drafts.map((draft,index) => <GroupEditor key={draft.localId} index={index} draft={draft} items={context.items} disabled={busy || stale} onChange={updated => setDrafts(current => current.map(value => value.localId === draft.localId ? updated : value))} onRemove={() => setDrafts(current => current.filter(value => value.localId !== draft.localId))}/>)}</>}
      {success && <Surface as="section" className="sorting-success" role="status"><CheckCircle2 size={30}/><h2>Đã phân loại</h2><p>{context.bagCode} · {waitingGroups.length} nhóm đồ đã được tạo</p>{waitingGroups.map(group => <GroupRow key={group.id} group={group} onPrint={() => void print([group])} printing={printing}/>)}<div className="sorting-success__actions"><Button variant="secondary" loading={printing} onClick={() => void print(waitingGroups)}><Printer size={18}/>In tất cả tem nhóm</Button><Button onClick={nextBag}>Phân loại túi tiếp theo</Button><ButtonLink to="/operations/waiting" variant="ghost">Xem đồ đang chờ</ButtonLink></div></Surface>}
    </main><aside className="sorting-side"><Surface><h2>Đối soát phân loại</h2><dl><div><dt>Túi</dt><dd>{context.bagCode}</dd></div><div><dt>Nhóm nháp</dt><dd>{drafts.length}</dd></div>{context.items.map(item => <div key={item.id}><dt>{item.serviceName} · {item.itemTypeName}</dt><dd>Còn {amount(remaining(item)/1000)} {unit(item.unitType)}</dd></div>)}</dl>{validBag && !success && <p>{context.lastUnsortedBag ? 'Đây là túi chưa phân loại cuối cùng. Phải đối soát đủ toàn bộ số lượng của đơn.' : 'Còn túi chưa phân loại khác. Được phép phân loại một phần, nhưng không được vượt số lượng đơn.'}</p>}{validBag && !success && <Button className="sorting-desktop-confirm" disabled={invalid || busy || stale} loading={busy} onClick={() => void confirm()}>Xác nhận phân loại</Button>}</Surface></aside></div>}
    {context && validBag && !success && <div className="sorting-fixed-action"><span>{drafts.length} nhóm · {invalid ? 'Chưa đủ điều kiện xác nhận' : 'Sẵn sàng xác nhận'}</span><Button disabled={invalid || busy || stale} loading={busy} onClick={() => void confirm()}>Xác nhận phân loại</Button></div>}
    <OverlayDialog open={reopenOpen} onClose={() => { if (!busy) setReopenOpen(false) }} title={`Phân loại lại ${context?.bagCode ?? ''}?`} description="Nhóm cũ sẽ chuyển sang đã hủy; mã nhóm không được dùng lại." footer={<><Button variant="secondary" disabled={busy} onClick={() => setReopenOpen(false)}>Quay lại</Button><Button variant="danger" loading={busy} disabled={!reason.trim()} onClick={() => void reopen()}>Mở lại phân loại</Button></>}><Field label="Lý do" required><textarea rows={4} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} autoFocus/></Field></OverlayDialog>
  </div>
}

function GroupRow({ group,onPrint,printing }:{group:ProcessingGroup;onPrint:()=>void;printing:boolean}) {
  return <div className="sorting-group-row"><div><strong>{group.groupCode}</strong><small>{group.serviceName} · {group.itemTypeName} · {amount(group.quantity)} {unit(group.unitType)}</small><small>{readiness(group)} · {colorText(group.colorGroup)} · {washText(group.washMode)}</small>{group.status === 'VOIDED' && <small>Đã hủy · {group.voidReason}</small>}</div>{group.status === 'WAITING' && <Button variant="secondary" disabled={printing} onClick={onPrint}><Printer size={17}/>In tem</Button>}</div>
}

function readiness(group:ProcessingGroup) { return group.separateWash ? 'Giặt riêng' : group.shareable ? 'Có thể ghép' : 'Cần xác minh' }

export function WaitingPage() {
  const {branchId,hasPermission} = useAuth()
  const {subscribe} = useRealtime()
  const queryClient = useQueryClient()
  const [search,setSearch] = useState('')
  const deferred = useDebouncedValue(search)
  const [page,setPage] = useState(0)
  const [size,setSize] = useState(20)
  const [serviceId,setServiceId] = useState('')
  const [itemTypeId,setItemTypeId] = useState('')
  const [color,setColor] = useState<ColorGroup|''>('')
  const [washMode,setWashMode] = useState<WashMode|''>('')
  const [separateWash,setSeparateWash] = useState('')
  const [promisedFrom,setPromisedFrom] = useState('')
  const [promisedTo,setPromisedTo] = useState('')
  const params = {branchId:branchId!,search:deferred || undefined,serviceId:serviceId ? Number(serviceId) : undefined,itemTypeId:itemTypeId ? Number(itemTypeId) : undefined,color:color || undefined,washMode:washMode || undefined,separateWash:separateWash ? separateWash === 'true' : undefined,promisedFrom:promisedFrom ? new Date(`${promisedFrom}T00:00:00`).toISOString() : undefined,promisedTo:promisedTo ? new Date(new Date(`${promisedTo}T00:00:00`).getTime()+86400000).toISOString() : undefined,page,size}
  const waiting = useQuery({queryKey:sortingKeys.waiting(branchId,params),queryFn:() => sortingApi.waiting(params),enabled:Boolean(branchId)})
  const stats = useQuery({queryKey:sortingKeys.stats(branchId),queryFn:() => sortingApi.stats(branchId!),enabled:Boolean(branchId)})
  const options = useQuery({queryKey:['sorting','filter-options',branchId],queryFn:() => sortingApi.filterOptions(branchId!),enabled:Boolean(branchId)})
  useEffect(() => subscribe('sorting.',() => { void queryClient.invalidateQueries({queryKey:sortingKeys.all}) }),[subscribe,queryClient])
  const activeFilters = [serviceId,itemTypeId,color,washMode,separateWash,promisedFrom,promisedTo].filter(Boolean).length
  const clear = () => {setServiceId('');setItemTypeId('');setColor('');setWashMode('');setSeparateWash('');setPromisedFrom('');setPromisedTo('');setPage(0)}
  const services = options.data?.services ?? []
  const itemTypes = options.data?.itemTypes ?? []
  return <div className="page-container waiting-page"><header className="waiting-header"><div><span className="sorting-kicker">Vận hành</span><h1>Đồ đang chờ</h1><p>Mỗi dòng là một nhóm đồ vật lý chưa đưa vào mẻ giặt.</p></div>{hasPermission(PERMISSION_CODES.SORTING_PROCESS) && <ButtonLink to="/operations/sorting"><ScanLine size={18}/>Phân loại đồ</ButtonLink>}</header>
    <div className="stat-card-grid waiting-stats"><StatCard icon={<PackageSearch/>} label="Tổng nhóm" value={stats.data?.total ?? '—'} tone="primary"/><StatCard icon={<CheckCircle2/>} label="Có thể ghép" value={stats.data?.shareable ?? '—'} tone="success"/><StatCard icon={<AlertTriangle/>} label="Giặt riêng" value={stats.data?.separate ?? '—'} tone="warning"/></div>
    <Surface as="section" className="waiting-list"><div className="waiting-toolbar"><OperationalSearch label="Tìm nhóm đồ" value={search} onChange={event => {setSearch(event.target.value);setPage(0)}} placeholder="Mã nhóm, mã đơn, tên khách…"/><CollapsibleFilterPanel label="Bộ lọc" activeCount={activeFilters} fieldsClassName="waiting-filters"><Field label="Dịch vụ"><select value={serviceId} onChange={event => {setServiceId(event.target.value);setPage(0)}}><option value="">Tất cả</option>{services.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field><Field label="Loại đồ"><select value={itemTypeId} onChange={event => {setItemTypeId(event.target.value);setPage(0)}}><option value="">Tất cả</option>{itemTypes.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field><Field label="Màu"><select value={color} onChange={event => {setColor(event.target.value as ColorGroup|'');setPage(0)}}><option value="">Tất cả</option>{colors.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Chế độ giặt"><select value={washMode} onChange={event => {setWashMode(event.target.value as WashMode|'');setPage(0)}}><option value="">Tất cả</option>{washes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Giặt riêng"><select value={separateWash} onChange={event => {setSeparateWash(event.target.value);setPage(0)}}><option value="">Tất cả</option><option value="false">Không giặt riêng</option><option value="true">Giặt riêng</option></select></Field><Field label="Hẹn trả từ"><input type="date" value={promisedFrom} onChange={event => {setPromisedFrom(event.target.value);setPage(0)}}/></Field><Field label="Hẹn trả đến"><input type="date" value={promisedTo} min={promisedFrom || undefined} onChange={event => {setPromisedTo(event.target.value);setPage(0)}}/></Field>{activeFilters > 0 && <Button variant="ghost" onClick={clear}>Xóa lọc</Button>}</CollapsibleFilterPanel></div>
      {waiting.isLoading ? <LoadingState rows={5}/> : waiting.isError ? <ErrorState title="Không tải được đồ đang chờ" body={errorText(waiting.error)} onRetry={() => void waiting.refetch()}/> : !waiting.data?.items.length ? <StatePanel title={deferred || activeFilters ? 'Không có nhóm phù hợp' : 'Chưa có đồ đang chờ'} body={deferred || activeFilters ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Nhóm đồ sẽ xuất hiện sau khi xác nhận phân loại túi.'}/> : <>
        <div className="waiting-table"><table><thead><tr><th>Nhóm đồ</th><th>Khách / đơn</th><th>Dịch vụ / loại đồ</th><th>Số lượng</th><th>Xử lý</th><th>Đã chờ</th><th>Hẹn trả</th></tr></thead><tbody>{waiting.data.items.map(group => <tr key={group.id}><td><strong>{group.groupCode}</strong></td><td>{group.customerName || 'Khách vãng lai'}<small>{group.orderCode}</small></td><td>{group.serviceName}<small>{group.itemTypeName}</small></td><td>{amount(group.quantity)} {unit(group.unitType)}</td><td>{readiness(group)}<small>{colorText(group.colorGroup)} · {careText(group.fabricCare)} · {washText(group.washMode)}</small></td><td><WaitTime value={group.createdAt}/></td><td>{group.promisedAt ? <DateTimeText value={group.promisedAt}/> : '—'}</td></tr>)}</tbody></table></div>
        <div className="waiting-cards">{waiting.data.items.map(group => <article key={group.id} className="waiting-card"><div><strong>{group.groupCode}</strong><span className={group.shareable ? 'sorting-tag' : 'sorting-tag sorting-tag--warning'}>{readiness(group)}</span></div><p>{group.customerName || 'Khách vãng lai'} · {group.orderCode}</p><h3>{group.serviceName} · {group.itemTypeName}</h3><strong>{amount(group.quantity)} {unit(group.unitType)}</strong><p>{colorText(group.colorGroup)} · {careText(group.fabricCare)} · {washText(group.washMode)}</p><small><Clock3 size={15}/> <WaitTime value={group.createdAt}/>{group.promisedAt && <> · Hẹn trả <DateTimeText value={group.promisedAt}/></>}</small></article>)}</div>
        <OperationalPagination page={page} size={size} totalElements={waiting.data.totalElements} totalPages={waiting.data.totalPages} noun="nhóm đồ" onPage={setPage} onSize={value => {setSize(value);setPage(0)}}/>
      </>}
    </Surface></div>
}

function WaitTime({value}:{value:string}) { const minutes = Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000));return <time dateTime={value} title={new Date(value).toLocaleString('vi-VN')}>{minutes < 60 ? `${minutes} phút` : `${Math.floor(minutes/60)} giờ ${minutes%60} phút`}</time> }
