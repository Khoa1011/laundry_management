import type { BatchCandidate, Quantity } from './types'

const unitText: Record<string, string> = { KG: 'KG', ITEM: 'MÓN', PAIR: 'ĐÔI', SET: 'BỘ', LOAD: 'MẺ', FIXED: 'GÓI' }

export const quantityText = (quantity: number, unit: string) =>
  `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(quantity)} ${unitText[unit] ?? unit}`

export const quantitiesText = (values: Quantity[]) =>
  values.map((value) => quantityText(value.quantity, value.unitType)).join(' · ')

export const sharingText = (value: string) =>
  value === 'PRIVATE_LOAD' ? 'Giặt riêng' : value === 'SHARED_PRIORITY' ? 'Ưu tiên ghép' : 'Giặt chung'

export const warningText: Record<string, string> = {
  ITEM_NOTE_PRESENT: 'Có ghi chú xử lý',
  DIFFERENT_ITEM_TYPES: 'Có loại đồ khác nhau',
  PRIORITY_ITEM: 'Có món ưu tiên',
  PROMISED_TIME_SOON: 'Có đơn hẹn trả sớm',
}

export type Compatibility = { kind: 'compatible' | 'warning' | 'blocked'; reasons: string[] }

export function candidateCompatibility(candidate: BatchCandidate, selected: BatchCandidate[]): Compatibility {
  if (selected.length) {
    if (selected[0].serviceId !== candidate.serviceId) return { kind: 'blocked', reasons: ['DIFFERENT_SERVICE'] }
    const combined = [...selected, candidate]
    const orders = new Set(combined.map((item) => item.orderId))
    if (orders.size > 1 && combined.some((item) => item.sharingMode === 'PRIVATE_LOAD')) {
      return { kind: 'blocked', reasons: ['PRIVATE_LOAD_CONFLICT'] }
    }
  }
  const reasons = [...candidate.warnings]
  if (selected.length && selected.some((item) => item.itemTypeId !== candidate.itemTypeId) && !reasons.includes('DIFFERENT_ITEM_TYPES')) {
    reasons.push('DIFFERENT_ITEM_TYPES')
  }
  return reasons.length ? { kind: 'warning', reasons } : { kind: 'compatible', reasons: [] }
}
