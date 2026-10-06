import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, CircleCheck, Clock3, Cog, Eye, FileText, Flag, Info, Layers3, PackageOpen, Pencil, Plus, Save, Scale, ShoppingBasket, Trash2, WashingMachine, X, XCircle } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { ConfirmDialog, OverlayDialog } from '../../components/OverlayDialog'
import { ErrorState, LoadingState, StatePanel } from '../../components/States'
import { Field } from '../../components/Field'
import { BulkActionBar, OperationalListHeader, OperationalListShell, OperationalPagination, OperationalSearch, OperationalStatusTabs, SelectionCheckbox } from '../../components/operational-list/OperationalList'
import { useDebouncedValue } from '../../components/operational-list/useDebouncedValue'
import { ActionMenu } from '../../components/ui/ActionMenu'
import { Button, ButtonLink } from '../../components/ui/Button'
import { CollapsibleFilterPanel } from '../../components/ui/CollapsibleFilterPanel'
import { DateTimeText } from '../../components/ui/DateTimeText'
import { DetailSectionTitle } from '../../components/ui/DetailSectionTitle'
import { Surface } from '../../components/ui/Surface'
import { useRealtime } from '../../realtime/context'
import { useToast } from '../../providers/ToastProvider'
import { batchKeys, washBatchApi } from './api'
import { BatchCandidateCard, BatchItemGroups, BatchStatusChip } from './BatchComponents'
import { candidateCompatibility, quantitiesText, warningText } from './presentation'
import type { BatchHistory, BatchItem, BatchListItem, WashBatchStatus } from './types'

const historyText:Record<string,string>={CREATED:'Tạo mẻ',ITEMS_ADDED:'Thêm đồ vào mẻ',ITEMS_REMOVED:'Xóa đồ khỏi mẻ',NOTE_UPDATED:'Cập nhật ghi chú mẻ',MARKED_READY:'Đánh dấu sẵn sàng',CANCELLED:'Hủy mẻ'}
const localDayBoundary=(value:string,offset:number)=>{const [year,month,day]=value.split('-').map(Number);return year&&month&&day?new Date(year,month-1,day+offset).toISOString():undefined}
function apiMessage(error:unknown){if(!(error instanceof ApiError))return 'Không thể hoàn tất thao tác.';return ({BATCH_VERSION_CONFLICT:'Mẻ giặt vừa được người khác cập nhật.',BATCH_ITEM_ALREADY_ASSIGNED:'Một món vừa được xếp vào mẻ khác.',BATCH_INCOMPATIBLE:'Không thể ghép các món đã chọn.',BATCH_IMMUTABLE:'Mẻ đã sẵn sàng nên không thể thay đổi thành phần.'} as Record<string,string>)[error.problem.errorCode??'']??error.message}

type MainTab='ALL'|WashBatchStatus
const mainTabs = [
  ['ALL', 'Tất cả', Layers3],
  ['DRAFT', 'Mẻ nháp', FileText],
  ['READY', 'Sẵn sàng', CheckCircle2],
  ['PROCESSING', 'Đang xử lý', Cog],
  ['COMPLETED', 'Hoàn tất', CircleCheck],
  ['CANCELLED', 'Đã hủy', XCircle],
] as const

export function WashBatchListPage(){
  const {branchId,hasPermission}=useAuth();const queryClient=useQueryClient();const {subscribe}=useRealtime();const {notify}=useToast();const navigate=useNavigate()
  const [tab,setTab]=useState<MainTab>('ALL');const [search,setSearch]=useState('');const debouncedSearch=useDebouncedValue(search);const [page,setPage]=useState(0);const [size,setSize]=useState(10)
  const [serviceId,setServiceId]=useState('');const [createdBy,setCreatedBy]=useState('');const [from,setFrom]=useState('');const [to,setTo]=useState('');const [loadType,setLoadType]=useState('');const [warning,setWarning]=useState('')
  const [selected,setSelected]=useState<Map<number,BatchListItem>>(()=>new Map());const [cancelBatch,setCancelBatch]=useState<BatchListItem>();const [cancelReason,setCancelReason]=useState('')
  const canCreate=hasPermission(PERMISSION_CODES.BATCH_CREATE);const canCancel=hasPermission(PERMISSION_CODES.BATCH_CANCEL)
  const stats=useQuery({queryKey:batchKeys.stats(branchId),queryFn:()=>washBatchApi.stats(branchId!),enabled:Boolean(branchId)})
  const filterOptions=useQuery({queryKey:batchKeys.filterOptions(branchId),queryFn:()=>washBatchApi.filterOptions(branchId!),enabled:Boolean(branchId)})
  const status=tab==='ALL'?undefined:tab
  const batches=useQuery({queryKey:batchKeys.list(branchId,status,debouncedSearch,page,size,serviceId?Number(serviceId):undefined,createdBy?Number(createdBy):undefined,from,to,loadType,warning),queryFn:()=>washBatchApi.list({branchId:branchId!,status,search:debouncedSearch||undefined,page,size,serviceId:serviceId?Number(serviceId):undefined,createdBy:createdBy?Number(createdBy):undefined,createdFrom:from?localDayBoundary(from,0):undefined,createdTo:to?localDayBoundary(to,1):undefined,loadType:loadType||undefined,warning:warning||undefined}),enabled:Boolean(branchId)})
  const totalQuery=useQuery({queryKey:['wash-batches','total',branchId],queryFn:()=>washBatchApi.list({branchId:branchId!,page:0,size:1}),enabled:Boolean(branchId)})
  const tabCount=(value:MainTab)=>{if(value==='ALL')return totalQuery.data?.totalElements;if(tab===value)return batches.data?.totalElements;if(value==='DRAFT')return stats.data?.draftCount;if(value==='READY')return stats.data?.readyCount;return undefined}
  const activeFilterCount=[serviceId,createdBy,from,to,loadType,warning].filter(Boolean).length
  const clearFilters=()=>{setServiceId('');setCreatedBy('');setFrom('');setTo('');setLoadType('');setWarning('');setPage(0)}
  useEffect(()=>subscribe('batch.',()=>{void queryClient.invalidateQueries({queryKey:batchKeys.all})}),[queryClient,subscribe])
  const cancel=useMutation({mutationFn:(batch:BatchListItem)=>washBatchApi.cancel(batch.id,branchId!,batch.version,cancelReason.trim()),onSuccess:()=>{setCancelBatch(undefined);setCancelReason('');void queryClient.invalidateQueries({queryKey:batchKeys.all});notify({message:'Đã hủy mẻ giặt.',tone:'success'})},onError:error=>notify({message:apiMessage(error),tone:'error'})})
  const pageItems=batches.data?.items??[];const selectedOnPage=pageItems.filter(item=>selected.has(item.id)).length
  const toggleItem=(item:BatchListItem,checked:boolean)=>setSelected(current=>{const next=new Map(current);if(checked)next.set(item.id,item);else next.delete(item.id);return next})
  const togglePage=(checked:boolean)=>setSelected(current=>{const next=new Map(current);pageItems.forEach(item=>{if(checked)next.set(item.id,item);else next.delete(item.id)});return next})
  const rowActions=(item:BatchListItem)=><div className="operational-row-actions"><ButtonLink className="batch-list-table__view-button" size="sm" variant="ghost" to={`/wash-batches/${item.id}`}><Eye size={17}/>Xem</ButtonLink><ActionMenu label={`Thao tác cho ${item.batchCode}`}><Link role="menuitem" data-tone="view" to={`/wash-batches/${item.id}`}><Eye size={24} aria-hidden="true"/><span className="action-menu__label">Xem chi tiết</span></Link>{canCancel&&['DRAFT','READY'].includes(item.status)&&<button type="button" role="menuitem" data-tone="danger" onClick={()=>{setCancelBatch(item);setCancelReason('')}}><Trash2 size={24} aria-hidden="true"/><span className="action-menu__label">Hủy mẻ</span></button>}</ActionMenu></div>
  const tabs=mainTabs.map(([value,label,Icon])=>({value,label,icon:<Icon size={18}/>,tone:value.toLowerCase(),count:tabCount(value)}))
  return <div className={`page-container wash-batch-page operational-list-page${selected.size?' operational-list-page--selected':''}`}><OperationalListShell className="batch-list-shell">
    <OperationalListHeader icon={<WashingMachine size={27}/>} title="Danh sách mẻ giặt" subtitle="Quản lý và theo dõi các mẻ giặt trong hệ thống" totalValue={totalQuery.isLoading?'—':`${totalQuery.data?.totalElements??0} mẻ giặt`} action={canCreate?<Button onClick={()=>navigate('/orders/batching')}><Plus size={18}/>Tạo mẻ giặt mới</Button>:undefined}/>
    <div className="operational-list__controls"><div className="operational-list__toolbar"><OperationalSearch label="Tìm mẻ giặt" value={search} onChange={event=>{setSearch(event.target.value);setPage(0)}} placeholder="Tìm kiếm theo mã mẻ…"/><CollapsibleFilterPanel className="batch-advanced-filters" label="Bộ lọc" activeCount={activeFilterCount} fieldsClassName="batch-filter-fields">
        <Field label="Dịch vụ"><select value={serviceId} onChange={event=>{setServiceId(event.target.value);setPage(0)}}><option value="">Tất cả dịch vụ</option>{filterOptions.data?.services.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>
        <Field label="Người tạo"><select value={createdBy} onChange={event=>{setCreatedBy(event.target.value);setPage(0)}}><option value="">Tất cả nhân viên</option>{filterOptions.data?.creators.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>
        <Field label="Loại tải"><select value={loadType} onChange={event=>{setLoadType(event.target.value);setPage(0)}}><option value="">Tất cả loại tải</option><option value="PRIVATE">Giặt riêng</option><option value="SHARED">Ghép chung</option></select></Field>
        <Field label="Cần kiểm tra"><select value={warning} onChange={event=>{setWarning(event.target.value);setPage(0)}}><option value="">Tất cả</option><option value="ITEM_NOTE_PRESENT">Có ghi chú xử lý</option><option value="DIFFERENT_ITEM_TYPES">Trộn loại đồ</option><option value="PRIORITY_ITEM">Có món ưu tiên</option><option value="PROMISED_TIME_SOON">Hẹn trả trong 24 giờ</option></select></Field>
        <Field label="Từ ngày tạo"><input type="date" value={from} onChange={event=>{setFrom(event.target.value);setPage(0)}}/></Field>
        <Field label="Đến ngày tạo"><input type="date" min={from||undefined} value={to} onChange={event=>{setTo(event.target.value);setPage(0)}}/></Field>
        {activeFilterCount>0&&<Button type="button" variant="ghost" onClick={clearFilters}>Xóa lọc</Button>}
      </CollapsibleFilterPanel></div><OperationalStatusTabs tabs={tabs} value={tab} onChange={value=>{setTab(value);setPage(0)}} label="Trạng thái mẻ giặt"/></div>
      <BulkActionBar count={selected.size} noun="mẻ giặt" onClear={()=>setSelected(new Map())}/>
      <BatchList query={batches} page={page} size={size} onPage={setPage} onSize={value=>{setSize(value);setPage(0)}} hasActiveFilters={Boolean(debouncedSearch||activeFilterCount||status)} selected={selected} selectedOnPage={selectedOnPage} onToggle={toggleItem} onTogglePage={togglePage} rowActions={rowActions} search={debouncedSearch} canCreate={canCreate}/>
    </OperationalListShell>
    <OverlayDialog open={Boolean(cancelBatch)} onClose={()=>!cancel.isPending&&setCancelBatch(undefined)} title={`Hủy mẻ ${cancelBatch?.batchCode??''}?`} description="Các món đang hoạt động sẽ được trả lại danh sách chờ ghép." footer={<><Button variant="secondary" disabled={cancel.isPending} onClick={()=>setCancelBatch(undefined)}>Quay lại</Button><Button variant="danger" loading={cancel.isPending} disabled={!cancelReason.trim()} onClick={()=>cancelBatch&&cancel.mutate(cancelBatch)}>Hủy mẻ</Button></>}><Field label="Lý do hủy" required><textarea rows={4} maxLength={500} value={cancelReason} onChange={event=>setCancelReason(event.target.value)} autoFocus/></Field></OverlayDialog>
  </div>
}

function BatchFlags({privateLoad,warnings}:{privateLoad:boolean;warnings:string[]}){return <span className="batch-list-flags">{privateLoad&&<span>Giặt riêng</span>}{warnings.map(code=><span key={code}>{warningText[code]??code}</span>)}</span>}

function BatchList({query,page,size,onPage,onSize,hasActiveFilters,selected,selectedOnPage,onToggle,onTogglePage,rowActions,search,canCreate}:{query:ReturnType<typeof useQuery<Awaited<ReturnType<typeof washBatchApi.list>>>>;page:number;size:number;onPage:(page:number)=>void;onSize:(size:number)=>void;hasActiveFilters:boolean;selected:Map<number,BatchListItem>;selectedOnPage:number;onToggle:(item:BatchListItem,checked:boolean)=>void;onTogglePage:(checked:boolean)=>void;rowActions:(item:BatchListItem)=>ReactNode;search:string;canCreate:boolean}){
  if(query.isLoading)return <LoadingState rows={5}/>;if(query.isError)return <ErrorState title="Không tải được danh sách mẻ" body="Kiểm tra kết nối rồi thử lại." onRetry={()=>void query.refetch()}/>;if(!query.data?.items.length)return <StatePanel className="batch-empty-state" icon={<img className="batch-empty-illustration" src="/images/wash-batches/wash-batches-empty.png" alt=""/>} title={search?`Không tìm thấy kết quả cho “${search}”`:hasActiveFilters?'Không có mẻ giặt phù hợp':'Chưa có mẻ giặt'} body={hasActiveFilters?'Thử đổi từ khóa hoặc bộ lọc.':'Các mẻ phù hợp sẽ xuất hiện tại đây.'} action={canCreate?<ButtonLink to="/orders/batching"><Plus size={18}/>Tạo mẻ giặt</ButtonLink>:undefined}/>
  return <><div className="batch-list-table"><table aria-label="Danh sách mẻ giặt"><thead><tr><th scope="col"><SelectionCheckbox checked={Boolean(query.data.items.length)&&selectedOnPage===query.data.items.length} indeterminate={selectedOnPage>0&&selectedOnPage<query.data.items.length} onChange={event=>onTogglePage(event.target.checked)} label="Chọn tất cả mẻ trên trang này"/></th><th scope="col">Mã mẻ</th><th scope="col">Dịch vụ</th><th scope="col">Cảnh báo / Ghi chú</th><th scope="col">Số đơn</th><th scope="col">Số món</th><th scope="col">Khối lượng / số lượng</th><th scope="col">Tạo lúc</th><th scope="col">Người tạo</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead><tbody>{query.data.items.map(item=><tr key={item.id} data-selected={selected.has(item.id)||undefined}><td><SelectionCheckbox checked={selected.has(item.id)} onChange={event=>onToggle(item,event.target.checked)} label={`Chọn ${item.batchCode}`}/></td><td><Link to={`/wash-batches/${item.id}`}>{item.batchCode}</Link></td><td><strong>{item.serviceName}</strong></td><td><BatchFlags privateLoad={item.privateLoad} warnings={item.warnings}/></td><td>{item.orderCount}</td><td>{item.itemCount}</td><td><strong>{quantitiesText(item.quantities)}</strong></td><td><DateTimeText value={item.createdAt} /></td><td>{item.createdBy.displayName}</td><td><BatchStatusChip status={item.status}/></td><td>{rowActions(item)}</td></tr>)}</tbody></table></div><div className="batch-list-mobile">{query.data.items.map(item=><article className="batch-list-card" data-selected={selected.has(item.id)||undefined} key={item.id}><div className="batch-list-card__head"><SelectionCheckbox checked={selected.has(item.id)} onChange={event=>onToggle(item,event.target.checked)} label={`Chọn ${item.batchCode}`}/><Link to={`/wash-batches/${item.id}`}>{item.batchCode}</Link><BatchStatusChip status={item.status}/></div><b>{item.serviceName}</b><BatchFlags privateLoad={item.privateLoad} warnings={item.warnings}/><div className="batch-list-card__metrics"><span>{item.orderCount} đơn · {item.itemCount} món</span><strong>{quantitiesText(item.quantities)}</strong></div><div className="batch-list-card__foot"><small><DateTimeText value={item.createdAt} /> · {item.createdBy.displayName}</small>{rowActions(item)}</div></article>)}</div><OperationalPagination page={page} size={size} totalElements={query.data.totalElements} totalPages={query.data.totalPages} noun="mẻ giặt" onPage={onPage} onSize={onSize}/></>
}


function WashBatchDetailLoading(){
  return <div className="page-container wash-batch-detail batch-detail-loading" aria-busy="true" aria-label="Đang tải chi tiết mẻ giặt">
    <div className="batch-detail-header"><LoadingState rows={1}/></div>
    <div className="batch-detail-loading__layout"><Surface><LoadingState rows={3}/></Surface><Surface><LoadingState rows={2}/></Surface></div>
  </div>
}

export function WashBatchDetailPage(){
  const id=Number(useParams().batchId)
  const {branchId,hasPermission}=useAuth()
  const queryClient=useQueryClient()
  const {subscribe}=useRealtime()
  const {notify}=useToast()
  const detail=useQuery({queryKey:batchKeys.detail(id),queryFn:()=>washBatchApi.get(id,branchId!),enabled:Boolean(id&&branchId)})
  const canAudit=hasPermission(PERMISSION_CODES.BATCH_AUDIT_READ)
  const canReadOrders=hasPermission(PERMISSION_CODES.ORDER_READ)
  const history=useQuery({queryKey:batchKeys.history(id),queryFn:()=>washBatchApi.history(id,branchId!),enabled:Boolean(id&&branchId&&canAudit)})
  const [addOpen,setAddOpen]=useState(false)
  const [readyOpen,setReadyOpen]=useState(false)
  const [cancelOpen,setCancelOpen]=useState(false)
  const [noteEditing,setNoteEditing]=useState(false)
  const [cancelReason,setCancelReason]=useState('')
  const [note,setNote]=useState('')
  const [addIds,setAddIds]=useState<number[]>([])
  const [stale,setStale]=useState(false)
  useEffect(()=>{if(detail.data)setNote(detail.data.note??'')},[detail.data])
  const editing=addOpen||noteEditing||note!==(detail.data?.note??'')
  useEffect(()=>subscribe('batch.',event=>{if(event.entityId!==id)return;if(editing)setStale(true);else{void queryClient.invalidateQueries({queryKey:batchKeys.detail(id)});void queryClient.invalidateQueries({queryKey:batchKeys.history(id)})}void queryClient.invalidateQueries({queryKey:['wash-batches','candidates']})}),[editing,id,queryClient,subscribe])
  const candidates=useQuery({queryKey:batchKeys.candidates(branchId,'',detail.data?.service.id),queryFn:()=>washBatchApi.candidates({branchId:branchId!,serviceId:detail.data!.service.id,page:0,size:100}),enabled:Boolean(addOpen&&branchId&&detail.data)})
  const command=useMutation({
    mutationFn:async(action:{type:'add'|'remove'|'note'|'ready'|'cancel';itemIds?:number[];reason?:string})=>{const batch=detail.data!;if(action.type==='add')return washBatchApi.addItems(id,branchId!,batch.version,action.itemIds!);if(action.type==='remove')return washBatchApi.removeItems(id,branchId!,batch.version,action.itemIds!);if(action.type==='note')return washBatchApi.updateNote(id,branchId!,batch.version,note.trim()||null);if(action.type==='ready')return washBatchApi.markReady(id,branchId!,batch.version);return washBatchApi.cancel(id,branchId!,batch.version,action.reason!)},
    onSuccess:(value,action)=>{queryClient.setQueryData(batchKeys.detail(id),value);void queryClient.invalidateQueries({queryKey:batchKeys.all});setAddOpen(false);setReadyOpen(false);setCancelOpen(false);setAddIds([]);setStale(false);if(action.type==='note'){setNote(value.note??'');setNoteEditing(false)}notify({message:'Đã cập nhật mẻ giặt.',tone:'success'})},
    onError:error=>{if(error instanceof ApiError&&error.status===409)setStale(true);notify({message:apiMessage(error),tone:'error'})},
  })
  if(detail.isLoading)return <WashBatchDetailLoading/>
  if(detail.isError||!detail.data)return <div className="page-container"><ErrorState title="Không tải được mẻ giặt" body="Mẻ không tồn tại hoặc nằm ngoài chi nhánh của bạn." onRetry={()=>void detail.refetch()}/></div>

  const batch=detail.data
  const draft=batch.status==='DRAFT'
  const canUpdate=draft&&hasPermission(PERMISSION_CODES.BATCH_UPDATE)
  const activeItemCount=batch.items.filter(item=>item.active).length
  const selectedAdd=candidates.data?.items.filter(item=>addIds.includes(item.orderItemId))??[]
  const cancelNoteEdit=()=>{setNote(batch.note??'');setNoteEditing(false)}
  const reloadLatest=()=>{setStale(false);setAddIds([]);setNoteEditing(false);void detail.refetch()}

  return <div className="page-container wash-batch-detail">
    <header className="batch-detail-header">
      <div className="batch-detail-header__identity">
        <Link className="batch-detail-back" to="/wash-batches"><ArrowLeft size={18} aria-hidden="true"/>Quay lại danh sách mẻ giặt</Link>
        <p className="batch-detail-kicker">Mẻ giặt</p>
        <div className="batch-detail-header__title"><h1>{batch.batchCode}</h1><BatchStatusChip status={batch.status}/></div>
        <p>{batch.service.name} <span aria-hidden="true">•</span> Tạo lúc <DateTimeText value={batch.createdAt} /> <span aria-hidden="true">•</span> {batch.createdBy.displayName}</p>
      </div>
      <div className="batch-detail-actions" aria-label="Thao tác mẻ giặt">
        {canUpdate&&<Button className="batch-detail-action--add" variant="secondary" onClick={()=>setAddOpen(true)}><Plus size={18} aria-hidden="true"/>Thêm đồ</Button>}
        {draft&&hasPermission(PERMISSION_CODES.BATCH_MARK_READY)&&<Button className="batch-detail-action--ready" variant="success" onClick={()=>setReadyOpen(true)}><CheckCircle2 size={18} aria-hidden="true"/>Đánh dấu sẵn sàng</Button>}
        {['DRAFT','READY'].includes(batch.status)&&hasPermission(PERMISSION_CODES.BATCH_CANCEL)&&<Button className="batch-detail-action--cancel" variant="danger" onClick={()=>setCancelOpen(true)}><Trash2 size={18} aria-hidden="true"/>Hủy mẻ</Button>}
      </div>
    </header>

    {stale&&<div className="stale-banner" role="alert"><AlertTriangle size={18} aria-hidden="true"/><span>Mẻ giặt vừa được người khác cập nhật.</span><Button size="sm" variant="secondary" onClick={reloadLatest}>Tải dữ liệu mới nhất</Button></div>}
    {batch.status==='READY'&&<div className="batch-state-helper batch-state-helper--ready"><CheckCircle2 size={20} aria-hidden="true"/><div><strong>Mẻ đã sẵn sàng để đưa vào máy.</strong>{batch.readyAt&&<small>{batch.readyBy?.displayName} <span aria-hidden="true">•</span> <DateTimeText value={batch.readyAt}/></small>}</div></div>}
    {batch.status==='CANCELLED'&&<div className="batch-state-helper batch-state-helper--cancelled"><XCircle size={20} aria-hidden="true"/><div><strong>Mẻ đã hủy.</strong>{batch.cancelReason&&<span>{batch.cancelReason}</span>}{batch.cancelledAt&&<small>{batch.cancelledBy?.displayName} <span aria-hidden="true">•</span> <DateTimeText value={batch.cancelledAt}/></small>}</div></div>}

    <div className="batch-detail-layout">
      <main className="batch-detail-main">
        <Surface as="section" className="batch-overview">
          <DetailSectionTitle className="batch-detail-section-title" icon={<Layers3 size={19}/>} title="Tổng quan"/>
          <dl>
            <div><span className="batch-overview-tile__icon"><Building2 size={20} aria-hidden="true"/></span><span><dt>Chi nhánh</dt><dd>{batch.branch.name}</dd></span></div>
            <div><span className="batch-overview-tile__icon"><Cog size={20} aria-hidden="true"/></span><span><dt>Dịch vụ</dt><dd>{batch.service.name}</dd></span></div>
            <div><span className="batch-overview-tile__icon"><ShoppingBasket size={20} aria-hidden="true"/></span><span><dt>Số đơn</dt><dd>{batch.summary.orderCount}</dd></span></div>
            <div><span className="batch-overview-tile__icon"><PackageOpen size={20} aria-hidden="true"/></span><span><dt>Số món</dt><dd>{batch.summary.itemCount}</dd></span></div>
            <div><span className="batch-overview-tile__icon"><Scale size={20} aria-hidden="true"/></span><span><dt>Tổng theo đơn vị</dt><dd>{quantitiesText(batch.summary.quantities)}</dd></span></div>
            <div><span className="batch-overview-tile__icon"><Flag size={20} aria-hidden="true"/></span><span><dt>Trạng thái</dt><dd><BatchStatusChip status={batch.status}/></dd></span></div>
          </dl>
        </Surface>

        <Surface as="section" className="batch-items">
          <DetailSectionTitle className="batch-detail-section-title" icon={<PackageOpen size={19}/>} title="Đồ trong mẻ"/>
          {batch.items.length?<BatchItemGroups items={batch.items} canReadOrders={canReadOrders} canRemove={canUpdate&&!stale&&!command.isPending&&activeItemCount>1} onRemove={(item:BatchItem)=>command.mutate({type:'remove',itemIds:[item.orderItemId]})}/>:<StatePanel compact title="Mẻ chưa có đồ" body="Chưa có món nào trong thành phần mẻ này."/>}
          {canUpdate&&activeItemCount===1&&<p className="batch-final-item-help"><Info size={17} aria-hidden="true"/><span><strong>Mẻ phải còn ít nhất 1 món.</strong> Hãy hủy mẻ nếu không còn sử dụng.</span></p>}
        </Surface>
      </main>

      <aside className="batch-detail-side">
        <Surface as="section" className="batch-note">
          <DetailSectionTitle className="batch-detail-section-title" icon={<FileText size={19}/>} title="Ghi chú mẻ" action={canUpdate&&!noteEditing?<Button size="sm" variant="ghost" onClick={()=>setNoteEditing(true)}><Pencil size={16} aria-hidden="true"/>Chỉnh sửa</Button>:undefined}/>
          {canUpdate&&noteEditing?<div className="batch-note__editor"><Field label="Nội dung ghi chú"><textarea rows={5} maxLength={2000} value={note} onChange={event=>setNote(event.target.value)} disabled={stale} autoFocus/></Field><div className="batch-note__actions"><Button variant="secondary" onClick={cancelNoteEdit} disabled={command.isPending}><X size={17} aria-hidden="true"/>Hủy</Button><Button loading={command.isPending} disabled={stale||note===(batch.note??'')} onClick={()=>command.mutate({type:'note'})}><Save size={17} aria-hidden="true"/>Lưu ghi chú</Button></div></div>:<p className={batch.note?'':'batch-note__empty'}>{batch.note||'Không có ghi chú.'}</p>}
        </Surface>
        {canAudit&&<BatchHistoryPanel query={history}/>}
      </aside>
    </div>

    <OverlayDialog open={addOpen} onClose={()=>!command.isPending&&setAddOpen(false)} title="Thêm đồ vào mẻ" description={`Dịch vụ cố định: ${batch.service.name}`} variant="drawer" footer={<><Button variant="secondary" onClick={()=>setAddOpen(false)}>Đóng</Button><Button loading={command.isPending} disabled={!addIds.length||stale} onClick={()=>command.mutate({type:'add',itemIds:addIds})}>Thêm {addIds.length} món</Button></>}>
      {candidates.isLoading?<LoadingState rows={5}/>:candidates.isError?<ErrorState title="Không tải được đồ chờ ghép" body="Thử tải lại." onRetry={()=>void candidates.refetch()}/>:<div className="batch-candidate-grid">{candidates.data?.items.map(candidate=><BatchCandidateCard key={candidate.orderItemId} candidate={candidate} selected={addIds.includes(candidate.orderItemId)} compatibility={candidateCompatibility(candidate,[...batch.items.filter(item=>item.active),...selectedAdd.filter(item=>item.orderItemId!==candidate.orderItemId)])} onChange={checked=>setAddIds(current=>checked?[...current,candidate.orderItemId]:current.filter(value=>value!==candidate.orderItemId))}/>)}</div>}
    </OverlayDialog>
    <ConfirmDialog open={readyOpen} onClose={()=>setReadyOpen(false)} onConfirm={()=>command.mutate({type:'ready'})} pending={command.isPending} title={`Đánh dấu mẻ ${batch.batchCode} là sẵn sàng?`} body="Sau khi đánh dấu sẵn sàng, thành phần mẻ sẽ được khóa và không thể thêm hoặc gỡ đồ." confirmLabel="Đánh dấu sẵn sàng">{batch.warnings.length>0&&<><p className="warning-summary">Có {batch.warnings.length} mục cần kiểm tra:</p><ul className="warning-list">{batch.warnings.map(code=><li key={code}>{warningText[code]??code}</li>)}</ul></>}</ConfirmDialog>
    <OverlayDialog open={cancelOpen} onClose={()=>setCancelOpen(false)} title={`Hủy mẻ ${batch.batchCode}?`} description="Các món đang hoạt động trong mẻ sẽ được trả lại danh sách chờ ghép." footer={<><Button variant="secondary" onClick={()=>setCancelOpen(false)}>Quay lại</Button><Button variant="danger" loading={command.isPending} disabled={!cancelReason.trim()} onClick={()=>command.mutate({type:'cancel',reason:cancelReason.trim()})}>Xác nhận hủy</Button></>}><Field label="Lý do hủy" required><textarea rows={4} maxLength={500} value={cancelReason} onChange={event=>setCancelReason(event.target.value)} autoFocus/></Field></OverlayDialog>
  </div>
}

function BatchHistoryPanel({query}:{query:ReturnType<typeof useQuery<BatchHistory[]>>}){
  return <Surface as="section" className="batch-history"><DetailSectionTitle className="batch-detail-section-title" icon={<Clock3 size={19}/>} title="Lịch sử mẻ"/>{query.isLoading?<LoadingState rows={3}/>:query.isError?<ErrorState title="Không tải được lịch sử" body="Thử tải lại." onRetry={()=>void query.refetch()}/>:query.data?.length?<div className="batch-history__timeline">{query.data.map(item=><article key={item.id}><span className="batch-history__node"><Clock3 size={14} aria-hidden="true"/></span><div><strong>{historyText[item.action]??'Cập nhật mẻ'}</strong><p>{item.actor.displayName} <span aria-hidden="true">•</span> <DateTimeText value={item.createdAt}/></p>{item.reason&&<small>{item.reason}</small>}</div></article>)}</div>:<p className="batch-history__empty">Chưa có sự kiện lịch sử.</p>}</Surface>
}
