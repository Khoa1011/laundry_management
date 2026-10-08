import { Barcode39 } from '../../components/Barcode39'
import { amount, careText, colorText, unit, washText } from './labels'
import type { ProcessingGroup } from './types'

export function GroupLabel({ group }: { group: ProcessingGroup }) {
  return <article className="order-bag-label">
    <p>Tem nhóm đồ · {group.separateWash ? 'Giặt riêng' : group.shareable ? 'Có thể ghép' : 'Cần xác minh'}</p>
    <h3>{group.groupCode}</h3>
    <Barcode39 payload={group.barcode} label={`Mã vạch nhóm ${group.groupCode}`} />
    <strong>{group.customerName || 'Khách vãng lai'}</strong>
    <dl>
      <div><dt>Đơn</dt><dd>{group.orderCode}</dd></div>
      <div><dt>Túi</dt><dd>{group.bagCode}</dd></div>
      <div><dt>Đồ</dt><dd>{group.serviceName} · {group.itemTypeName}</dd></div>
      <div><dt>Số lượng</dt><dd>{amount(group.quantity)} {unit(group.unitType)}</dd></div>
      <div><dt>Xử lý</dt><dd>{colorText(group.colorGroup)} · {careText(group.fabricCare)} · {washText(group.washMode)}</dd></div>
    </dl>
  </article>
}
