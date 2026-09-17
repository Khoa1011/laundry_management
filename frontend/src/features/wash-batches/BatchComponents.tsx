import { AlertTriangle, Ban, CheckCircle2, StickyNote } from 'lucide-react'
import { Link } from 'react-router-dom'
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

export function BatchItemGroups({ items,canRemove,onRemove }: { items:BatchItem[];canRemove:boolean;onRemove:(item:BatchItem)=>void }){
  const groups=groupByOrder(items)
  return <div className="batch-item-groups">{groups.map(group=><section className="batch-order-group" key={group[0].orderId}><header><div><Link to={`/orders/${group[0].orderId}`}>{group[0].orderCode}</Link><p>{group[0].customerName||'Khách vãng lai'}{group[0].customerPhone&&` · ${group[0].customerPhone}`}</p></div>{group[0].promisedAt&&<small>Hẹn trả {new Date(group[0].promisedAt).toLocaleString('vi-VN')}</small>}</header>
    {group.map(item=><article key={item.batchItemId} className={!item.active?'batch-item--removed':''}><div><strong>{item.itemTypeName}</strong><span>{quantityText(item.quantity,item.unitType)} · {sharingText(item.sharingMode)}</span>{item.itemNote&&<p><StickyNote size={14}/> Ghi chú xử lý: {item.itemNote}</p>}{!item.active&&<small>Đã rời khỏi mẻ</small>}</div>{canRemove&&item.active&&<button type="button" className="button button--secondary" onClick={()=>onRemove(item)}>Xóa khỏi mẻ</button>}</article>)}</section>)}</div>
}
