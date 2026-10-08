import { Ban, Eye, Plus, Printer, RotateCcw, ShoppingBag } from 'lucide-react'
import { useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ApiError } from '../../api/client'
import { OverlayDialog } from '../../components/OverlayDialog'
import { Field } from '../../components/Field'
import { Button } from '../../components/ui/Button'
import { Surface } from '../../components/ui/Surface'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { useToast } from '../../providers/ToastProvider'
import { orderApi } from './api'
import type { Order, OrderBag } from './types'

// Code 39 carries only a branch-scoped bag identifier. The visible bag code remains
// human-readable even if a branch's order-code format changes later.
const code39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', B: 'nnwnnwnnw', '*': 'nwnnwnwnn',
}

function BagBarcode({ bag }: { bag: OrderBag }) {
  const payload = `B${bag.id}`
  let position = 8
  const bars: Array<{ x: number; width: number }> = []
  for (const character of `*${payload}*`) {
    for (const [index, kind] of [...code39[character]].entries()) {
      const width = kind === 'w' ? 5 : 2
      if (index % 2 === 0) bars.push({ x: position, width })
      position += width
    }
    position += 2
  }
  return <><svg className="order-bag-barcode" viewBox={`0 0 ${position + 8} 56`} role="img" aria-label={`Mã vạch túi ${bag.bagCode}`} preserveAspectRatio="xMidYMid meet">
    <rect width={position + 8} height="56" fill="white" />
    {bars.map((bar, index) => <rect key={index} x={bar.x} y="2" width={bar.width} height="48" fill="black" />)}
  </svg><small className="order-bag-label__payload">{payload}</small></>
}

function BagLabel({ order, bag }: { order: Order; bag: OrderBag }) {
  return <article className="order-bag-label">
    <p>{bag.status === 'VOIDED' ? 'Mã túi đã hủy · Không còn hiệu lực' : bag.status === 'LEGACY_UNVERIFIED' ? 'Tem đơn cũ · Chưa xác minh túi' : 'Tem túi đồ'}</p>
    <h3>{bag.bagCode}</h3>
    <BagBarcode bag={bag} />
    <strong>{order.customerName || 'Khách vãng lai'}</strong>
    <dl>
      <div><dt>Đơn hàng</dt><dd>{order.orderCode}</dd></div>
      <div><dt>Túi</dt><dd>{bag.sequenceNumber}/{order.bags.length}</dd></div>
      <div><dt>Nhận lúc</dt><dd>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(bag.createdAt || order.createdAt))}</dd></div>
    </dl>
  </article>
}

interface BagPrintSession { submit: (order: Order, bags: OrderBag[]) => void; close: () => void }
interface BagPrintGateway { open: () => BagPrintSession | null }

function sendLabelsToBrowser(target: Window, order: Order, bags: OrderBag[]) {
  const labels = bags.map(bag => renderToStaticMarkup(<BagLabel order={order} bag={bag} />)).join('')
  target.document.open()
  target.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Tem túi đồ</title><style>
    @page{size:80mm 70mm;margin:3mm}body{font:14px Arial,sans-serif;color:#111;margin:0}
    .order-bag-label{box-sizing:border-box;width:74mm;padding:3mm;break-after:page;text-align:center}
    .order-bag-label p{margin:0 0 3mm}.order-bag-label h3{font-size:20px;margin:0 0 3mm}
    .order-bag-label strong{display:block;margin:2mm 0;overflow-wrap:anywhere}
    .order-bag-barcode{display:block;width:100%;height:20mm}
    .order-bag-label__payload{display:block;margin:1mm 0;font-size:12px}
    .order-bag-label dl{margin:3mm 0 0;border-top:1px solid #111;text-align:left}
    .order-bag-label dl div{display:flex;justify-content:space-between;gap:3mm;padding-top:2mm}
    .order-bag-label dd{margin:0;font-weight:bold;overflow-wrap:anywhere}
  </style></head><body>${labels}</body></html>`)
  target.document.close()
  target.focus()
  target.print()
}

// The browser implementation reports only a print request. A future POS/native
// bridge can implement this boundary and provide hardware acknowledgement.
const browserBagPrintGateway: BagPrintGateway = {
  open: () => {
    const target = window.open('', '_blank', 'width=480,height=680')
    return target ? { submit: (order, bags) => sendLabelsToBrowser(target, order, bags), close: () => target.close() } : null
  },
}

type PrintState = 'PRINTING' | 'REQUESTED' | 'FAILED'

function mutationMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Không thể cập nhật túi. Kiểm tra kết nối rồi thử lại.'
  if (error.status === 403) return 'Bạn không có quyền cập nhật đơn này.'
  if (error.problem.errorCode === 'ORDER_IMMUTABLE') return 'Chỉ có thể thay đổi túi khi đơn đang ở trạng thái Đã nhận.'
  if (error.problem.errorCode === 'ORDER_BAG_LAST_ACTIVE') return 'Đơn hàng phải còn ít nhất một túi đang nhận.'
  if (error.problem.errorCode === 'ORDER_BAG_ALREADY_VOIDED') return 'Túi này đã được hủy trước đó.'
  if (error.problem.errorCode === 'ORDER_BAG_LIMIT_REACHED') return 'Đơn đã đạt giới hạn 99 mã túi.'
  if (error.status === 404) return 'Không tìm thấy đơn hoặc túi trong chi nhánh này.'
  return 'Không thể cập nhật túi. Dữ liệu đang nhập được giữ lại; hãy thử lại.'
}

export function OrderBags({ order, onBagUpdated, onOrderUpdated, mutationsDisabled = false }: {
  order: Order
  onBagUpdated: (bag: OrderBag) => void
  onOrderUpdated?: (order: Order) => void
  mutationsDisabled?: boolean
}) {
  const { hasPermission } = useAuth()
  const { notify } = useToast()
  const [preview, setPreview] = useState<OrderBag | null>(null)
  const [printStates, setPrintStates] = useState<Record<number, PrintState>>({})
  const [printingAll, setPrintingAll] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [voidTarget, setVoidTarget] = useState<OrderBag | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [mutationError, setMutationError] = useState('')
  const [mutating, setMutating] = useState(false)
  const printLock = useRef(false)
  const mutationLock = useRef(false)
  const canPrint = hasPermission(PERMISSION_CODES.ORDER_READ) && hasPermission(PERMISSION_CODES.ORDER_BAG_PRINT)
  const canMutate = Boolean(onOrderUpdated) && !mutationsDisabled && order.status === 'RECEIVED' && hasPermission(PERMISSION_CODES.ORDER_UPDATE)
  const activeCount = order.bags.filter(bag => bag.status === 'RECEIVED').length
  const printableBags = order.bags.filter(bag => bag.status === 'RECEIVED')
  const previewBag = preview && (order.bags.find(bag => bag.id === preview.id) ?? preview)
  const isPrinting = Object.values(printStates).includes('PRINTING')

  const setState = (bagId: number, state: PrintState) => setPrintStates(current => ({ ...current, [bagId]: state }))
  const print = async (requested: OrderBag[]) => {
    if (printLock.current) return
    const eligible = requested.filter(bag => bag.status !== 'VOIDED')
    if (!eligible.length) return
    const session = browserBagPrintGateway.open()
    if (!session) {
      eligible.forEach(bag => setState(bag.id, 'FAILED'))
      notify({ message: 'Trình duyệt đã chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại.', tone: 'error' })
      return
    }
    printLock.current = true
    eligible.forEach(bag => setState(bag.id, 'PRINTING'))
    setPrintingAll(eligible.length > 1)
    const results = await Promise.allSettled(eligible.map(bag => orderApi.requestBagPrint(order.id, bag.id, order.branchId)))
    const printable: OrderBag[] = []
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        printable.push(result.value)
        onBagUpdated(result.value)
      } else {
        setState(eligible[index].id, 'FAILED')
      }
    })
    try {
      if (printable.length) {
        session.submit(order, printable)
        printable.forEach(bag => setState(bag.id, 'REQUESTED'))
        notify({ message: `Đã gửi yêu cầu in ${printable.length} tem. Kiểm tra kết quả trên máy in.`, tone: 'success' })
      } else session.close()
    } catch {
      printable.forEach(bag => setState(bag.id, 'FAILED'))
      session.close()
    } finally {
      setPrintingAll(false)
      printLock.current = false
    }
    if (results.some(result => result.status === 'rejected')) {
      const denied = results.some(result => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status === 403)
      notify({ message: denied ? 'Bạn không có quyền in tem túi.' : 'Có tem chưa gửi được yêu cầu in. Hãy thử lại.', tone: 'error' })
    }
  }

  const closeMutation = () => {
    if (mutationLock.current) return
    setAddOpen(false); setVoidTarget(null); setVoidReason(''); setMutationError('')
  }
  const addBag = async () => {
    if (mutationLock.current || !canMutate) return
    mutationLock.current = true; setMutating(true); setMutationError('')
    try {
      const updated = await orderApi.addBag(order.id, order.branchId)
      onOrderUpdated?.(updated)
      setAddOpen(false)
      notify({ message: `Đã thêm túi ${updated.bags.at(-1)?.bagCode ?? ''}.`, tone: 'success' })
    } catch (error) { setMutationError(mutationMessage(error)) }
    finally { mutationLock.current = false; setMutating(false) }
  }
  const voidBag = async () => {
    if (mutationLock.current || !canMutate || !voidTarget || !voidReason.trim()) return
    mutationLock.current = true; setMutating(true); setMutationError('')
    try {
      const updated = await orderApi.voidBag(order.id, voidTarget.id, order.branchId, voidReason.trim())
      onOrderUpdated?.(updated)
      setVoidTarget(null); setVoidReason('')
      notify({ message: `Đã hủy túi ${voidTarget.bagCode}. Mã túi được giữ trong lịch sử.`, tone: 'success' })
    } catch (error) { setMutationError(mutationMessage(error)) }
    finally { mutationLock.current = false; setMutating(false) }
  }

  return <Surface as="section" className="order-bags">
    <div className="order-bags__heading">
      <div><h2><ShoppingBag size={20} aria-hidden="true" />Túi đồ ({order.bags?.length ?? 0})</h2><p>Mỗi túi có mã riêng để nhận diện tại quầy.</p></div>
      <div className="order-bags__heading-actions">
        {canMutate && <Button type="button" variant="secondary" onClick={() => { setMutationError(''); setAddOpen(true) }}><Plus size={18} />Thêm túi</Button>}
        {canPrint && printableBags.length > 0 && <Button type="button" variant="secondary" loading={printingAll} disabled={isPrinting} onClick={() => void print(printableBags)}><Printer size={18} />In tất cả tem</Button>}
      </div>
    </div>
    {order.bags?.length ? <div className="order-bags__list">{order.bags.map(bag => {
      const state = printStates[bag.id]
      return <div className={`order-bags__row${bag.status === 'VOIDED' ? ' order-bags__row--voided' : ''}`} key={bag.id}>
        <div className="order-bags__identity"><strong>{bag.bagCode}</strong><span>Túi {bag.sequenceNumber}/{order.bags.length} · {bag.status === 'VOIDED' ? 'Hủy bỏ' : bag.status === 'LEGACY_UNVERIFIED' ? 'Đơn cũ · Chưa xác minh túi thực tế' : 'Đã nhận'}</span>
          {bag.status === 'VOIDED' ? <small>Lý do: {bag.voidReason}</small> : <small role="status">{state === 'PRINTING' ? 'Đang gửi yêu cầu in…' : state === 'FAILED' ? 'In thất bại · Thử lại' : state === 'REQUESTED' || bag.printRequestCount > 0 ? 'Đã gửi lệnh in · Kiểm tra máy in' : 'Chưa gửi lệnh in'}</small>}
          {canMutate && bag.status === 'RECEIVED' && activeCount === 1 && <small>Đơn phải còn ít nhất một túi đang nhận.</small>}
        </div>
        <div className="order-bags__actions"><Button type="button" variant="ghost" onClick={() => setPreview(bag)}><Eye size={17} />Xem mã</Button>{canPrint && bag.status !== 'VOIDED' && <Button type="button" variant="secondary" loading={state === 'PRINTING'} disabled={printingAll || isPrinting} onClick={() => void print([bag])}>{bag.printRequestCount > 0 || state === 'REQUESTED' ? <RotateCcw size={17} /> : <Printer size={17} />}{bag.printRequestCount > 0 || state === 'REQUESTED' ? 'In lại' : 'In tem'}</Button>}{canMutate && bag.status === 'RECEIVED' && activeCount > 1 && <Button type="button" variant="danger" onClick={() => { setMutationError(''); setVoidReason(''); setVoidTarget(bag) }}><Ban size={17} />Hủy túi</Button>}</div>
      </div>
    })}</div> : <p>Đơn chưa có túi đồ.</p>}
    <OverlayDialog open={Boolean(preview)} onClose={() => setPreview(null)} title={`Tem túi ${preview?.bagCode ?? ''}`} footer={<>{canPrint && previewBag && previewBag.status !== 'VOIDED' && <Button type="button" loading={printStates[previewBag.id] === 'PRINTING'} disabled={isPrinting} onClick={() => void print([previewBag])}><Printer size={18} />{previewBag.printRequestCount > 0 ? 'In lại' : 'In tem'}</Button>}<Button type="button" variant="secondary" onClick={() => setPreview(null)}>Đóng</Button></>}>
      {previewBag && <BagLabel order={order} bag={previewBag} />}
    </OverlayDialog>
    <OverlayDialog open={addOpen} onClose={closeMutation} title="Thêm túi mới" footer={<><Button type="button" variant="secondary" disabled={mutating} onClick={closeMutation}>Hủy</Button><Button type="button" loading={mutating} onClick={() => void addBag()}>Thêm túi</Button></>}>
      <p>Hệ thống sẽ cấp mã cho túi tiếp theo. Mã túi đã tạo sẽ không thể đổi.</p>
      {mutationError && <p className="form-error" role="alert">{mutationError}</p>}
    </OverlayDialog>
    <OverlayDialog open={Boolean(voidTarget)} onClose={closeMutation} title={`Hủy túi ${voidTarget?.bagCode ?? ''}?`} footer={<><Button type="button" variant="secondary" disabled={mutating} onClick={closeMutation}>Quay lại</Button><Button type="button" variant="danger" loading={mutating} disabled={!voidReason.trim()} onClick={() => void voidBag()}>Hủy túi</Button></>}>
      <p>Mã túi sẽ được giữ lại trong lịch sử và không thể sử dụng lại.</p>
      <Field label="Lý do" required error={mutationError}><textarea rows={3} maxLength={500} value={voidReason} onChange={event => { setVoidReason(event.target.value); setMutationError('') }} autoFocus /></Field>
    </OverlayDialog>
  </Surface>
}
