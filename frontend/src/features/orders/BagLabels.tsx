import { Eye, Printer, RotateCcw, ShoppingBag } from 'lucide-react'
import { useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ApiError } from '../../api/client'
import { OverlayDialog } from '../../components/OverlayDialog'
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
    <p>{bag.status === 'LEGACY_UNVERIFIED' ? 'Tem đơn cũ · Chưa xác minh túi' : 'Tem túi đồ'}</p>
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

export function OrderBags({ order, onBagUpdated }: { order: Order; onBagUpdated: (bag: OrderBag) => void }) {
  const { hasPermission } = useAuth()
  const { notify } = useToast()
  const [preview, setPreview] = useState<OrderBag | null>(null)
  const [printStates, setPrintStates] = useState<Record<number, PrintState>>({})
  const [printingAll, setPrintingAll] = useState(false)
  const printLock = useRef(false)
  const canPrint = hasPermission(PERMISSION_CODES.ORDER_READ) && hasPermission(PERMISSION_CODES.ORDER_BAG_PRINT)
  const previewBag = preview && (order.bags.find(bag => bag.id === preview.id) ?? preview)
  const isPrinting = Object.values(printStates).includes('PRINTING')

  const setState = (bagId: number, state: PrintState) => setPrintStates(current => ({ ...current, [bagId]: state }))
  const print = async (requested: OrderBag[]) => {
    if (printLock.current) return
    const session = browserBagPrintGateway.open()
    if (!session) {
      requested.forEach(bag => setState(bag.id, 'FAILED'))
      notify({ message: 'Trình duyệt đã chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại.', tone: 'error' })
      return
    }
    printLock.current = true
    requested.forEach(bag => setState(bag.id, 'PRINTING'))
    setPrintingAll(requested.length > 1)
    const results = await Promise.allSettled(requested.map(bag => orderApi.requestBagPrint(order.id, bag.id, order.branchId)))
    const printable: OrderBag[] = []
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        printable.push(result.value)
        onBagUpdated(result.value)
      } else {
        setState(requested[index].id, 'FAILED')
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

  return <Surface as="section" className="order-bags">
    <div className="order-bags__heading">
      <div><h2><ShoppingBag size={20} aria-hidden="true" />Túi đồ ({order.bags?.length ?? 0})</h2><p>Mỗi túi có mã riêng để nhận diện tại quầy.</p></div>
      {canPrint && Boolean(order.bags?.length) && <Button type="button" variant="secondary" loading={printingAll} disabled={isPrinting} onClick={() => void print(order.bags)}><Printer size={18} />In tất cả tem</Button>}
    </div>
    {order.bags?.length ? <div className="order-bags__list">{order.bags.map(bag => {
      const state = printStates[bag.id]
      return <div className="order-bags__row" key={bag.id}>
        <div className="order-bags__identity"><strong>{bag.bagCode}</strong><span>Túi {bag.sequenceNumber}/{order.bags.length} · {bag.status === 'LEGACY_UNVERIFIED' ? 'Đơn cũ · Chưa xác minh túi thực tế' : 'Đã nhận'}</span><small role="status">{state === 'PRINTING' ? 'Đang gửi yêu cầu in…' : state === 'FAILED' ? 'In thất bại · Thử lại' : state === 'REQUESTED' || bag.printRequestCount > 0 ? 'Đã gửi lệnh in · Kiểm tra máy in' : 'Chưa gửi lệnh in'}</small></div>
        <div className="order-bags__actions"><Button type="button" variant="ghost" onClick={() => setPreview(bag)}><Eye size={17} />Xem mã</Button>{canPrint && <Button type="button" variant="secondary" loading={state === 'PRINTING'} disabled={printingAll || isPrinting} onClick={() => void print([bag])}>{bag.printRequestCount > 0 || state === 'REQUESTED' ? <RotateCcw size={17} /> : <Printer size={17} />}{bag.printRequestCount > 0 || state === 'REQUESTED' ? 'In lại' : 'In tem'}</Button>}</div>
      </div>
    })}</div> : <p>Đơn chưa có túi đồ.</p>}
    <OverlayDialog open={Boolean(preview)} onClose={() => setPreview(null)} title={`Tem túi ${preview?.bagCode ?? ''}`} footer={<>{canPrint && previewBag && <Button type="button" loading={printStates[previewBag.id] === 'PRINTING'} disabled={isPrinting} onClick={() => void print([previewBag])}><Printer size={18} />{previewBag.printRequestCount > 0 ? 'In lại' : 'In tem'}</Button>}<Button type="button" variant="secondary" onClick={() => setPreview(null)}>Đóng</Button></>}>
      {previewBag && <BagLabel order={order} bag={previewBag} />}
    </OverlayDialog>
  </Surface>
}
