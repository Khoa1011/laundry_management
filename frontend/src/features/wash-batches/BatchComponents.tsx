import { AlertTriangle, Ban, CalendarDays, CheckCircle2, PackageOpen, ShoppingBasket, StickyNote, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ActionMenu } from '../../components/ui/ActionMenu'
import { promisedDateLabel } from '../../utils/promisedDate'
import { quantityText, sharingText, warningText, type Compatibility } from './presentation'
import type { BatchCandidate, BatchItem, WashBatchStatus } from './types'

const statusText:Record<WashBatchStatus,string>={DRAFT:'Mẻ nháp',READY:'Sẵn sàng',PROCESSING:'Đang xử lý',COMPLETED:'Hoàn tất',CANCELLED:'Đã hủy'}
const blockerText:Record<string,string>={DIFFERENT_SERVICE:'Khác dịch vụ',PRIVATE_LOAD_CONFLICT:'Yêu cầu giặt riêng',ORDER_NOT_WAITING:'Không còn chờ xử lý',ALREADY_ASSIGNED:'Đã nằm trong mẻ khác'}
const groupByOrder=<T extends {orderId:number}>(items:T[])=>{const groups=new Map<number,T[]>();items.forEach(item=>groups.set(item.orderId,[...(groups.get(item.orderId)??[]),item]));return [...groups.values()]}

export function BatchStatusChip({ status }: { status:WashBatchStatus }) { return <span className={`batch-status batch-status--${status.toLowerCase()}`}>{statusText[status]}</span> }

export function CompatibilityBadge({ value }: { value:Compatibility }){
  const Icon=value.kind==='compatible'?CheckCircle2:value.kind==='warning'?AlertTriangle:Ban
  const label=value.kind==='compatible'?'Phù hợp':value.kind==='warning'?'Cần kiểm tra':'Không thể ghép'
  return <span className={`compatibility-badge compatibility-badge--${value.kind}`}><Icon size={15} aria-hidden="true" />{label}</span>
}

export function BatchCandidateCard({ candidate,selected,onChange,compatibility }: { candidate:BatchCandidate;selected:boolean;onChange:(checked:boolean)=>void;compatibility:Compatibility }){
  const blocked=compatibility.kind==='blocked'
  return <label className={`batch-candidate${selected?' batch-candidate--selected':''}${blocked?' batch-candidate--blocked':''}`}>
    <input type="checkbox" checked={selected} disabled={blocked&&!selected} onChange={event=>onChange(event.target.checked)} aria-label={`Chọn ${candidate.orderCode} ${candidate.itemTypeName}`} />
    <span className="batch-candidate__body"><span className="batch-candidate__top"><strong>{candidate.orderCode}</strong><b>{quantityText(candidate.quantity,candidate.unitType)}</b></span>
      <span className="batch-candidate__customer">{candidate.customerName||'Khách vãng lai'}{candidate.customerPhone&&<small>{candidate.customerPhone}</small>}</span>
      <span className="batch-candidate__service">{candidate.serviceName} · {candidate.itemTypeName}</span>
      <span className="batch-candidate__meta"><span className={`sharing-chip sharing-chip--${candidate.sharingMode.toLowerCase()}`}>{sharingText(candidate.sharingMode)}</span>{candidate.itemNote&&<span className="note-flag"><StickyNote size={14} />Có ghi chú</span>}</span>
      <span className="batch-candidate__compat"><CompatibilityBadge value={compatibility}/>{compatibility.reasons.length>0&&<small>{compatibility.reasons.map(code=>warningText[code]??blockerText[code]??code).join(' · ')}</small>}</span>
    </span>
  </label>
}

export function BatchSummary({ selected }: { selected:BatchCandidate[] }){
  const quantities=new Map<string,number>();selected.forEach(item=>quantities.set(item.unitType,(quantities.get(item.unitType)??0)+item.quantity))
  const groups=groupByOrder(selected)
  return <div className="batch-summary"><div className="batch-summary__facts"><span><small>Dịch vụ</small><strong>{selected[0]?.serviceName??'Chưa chọn'}</strong></span><span><small>Số đơn</small><strong>{new Set(selected.map(item=>item.orderId)).size}</strong></span><span><small>Số món</small><strong>{selected.length}</strong></span></div>
    <div className="batch-summary__quantities">{[...quantities].map(([unit,value])=><strong key={unit}>{quantityText(value,unit)}</strong>)}</div>
    <div className="batch-summary__orders">{groups.map(group=><div key={group[0].orderId}><strong>{group[0].orderCode} · {group[0].customerName||'Khách vãng lai'}</strong>{group.map(item=><small key={item.orderItemId}>{item.itemTypeName} · {quantityText(item.quantity,item.unitType)}</small>)}</div>)}</div></div>
}

export function BatchItemGroups({ items,canReadOrders,canRemove,onRemove }: { items:BatchItem[];canReadOrders:boolean;canRemove:boolean;onRemove:(item:BatchItem)=>void }){
  const groups=groupByOrder(items)
  return <div className="batch-item-groups">{groups.map(group=><section className="batch-order-group" key={group[0].orderId}>
    <header><div className="batch-order-group__identity"><span className="batch-order-group__icon" aria-hidden="true"><ShoppingBasket size={20}/></span><div>{canReadOrders?<Link to={`/orders/${group[0].orderId}`}>{group[0].orderCode}</Link>:<strong>{group[0].orderCode}</strong>}<p>{group[0].customerName||'Khách vãng lai'}{canReadOrders&&group[0].customerPhone&&` · ${group[0].customerPhone}`}</p></div></div>{group[0].promisedAt&&<span className="batch-order-group__promise"><CalendarDays size={17} aria-hidden="true"/><small>Hẹn trả</small><strong>{promisedDateLabel(group[0].promisedAt)}</strong></span>}</header>
    <div className="batch-order-group__items">{group.map(item=><article key={item.batchItemId} className="batch-item-row"><span className="batch-item-row__icon" aria-hidden="true"><PackageOpen size={20}/></span><div className="batch-item-row__body"><strong>{item.itemTypeName}</strong><span className="batch-item-row__meta"><b>{quantityText(item.quantity,item.unitType)}</b><span className={`sharing-chip sharing-chip--${item.sharingMode.toLowerCase()}`}>{sharingText(item.sharingMode)}</span></span>{item.itemNote&&<p><StickyNote size={14} aria-hidden="true"/> Ghi chú xử lý: {item.itemNote}</p>}</div>{canRemove&&item.active&&<ActionMenu className="batch-item-row__menu" label={`Thao tác cho ${item.itemTypeName}`}><button type="button" role="menuitem" data-tone="danger" onClick={()=>onRemove(item)}><Trash2 size={24} aria-hidden="true"/><span className="action-menu__label">Xóa khỏi mẻ</span></button></ActionMenu>}</article>)}</div>
  </section>)}</div>
}
