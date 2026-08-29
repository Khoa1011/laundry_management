interface SanitizeMoneyOptions {
  maxIntegerDigits?: number
  fractionDigits?: number
}

export function sanitizeMoneyInput(input: string, options: SanitizeMoneyOptions = {}) {
  const maxIntegerDigits = options.maxIntegerDigits ?? 15
  const fractionDigits = options.fractionDigits ?? 0
  const normalized = fractionDigits
  ? input.replace(/,/g, '').replace(/[^\d.]/g, '')
  : input.replace(/[,.]/g, '').replace(/\D/g, '')
  const decimalIndex = normalized.indexOf('.')
  const integerSource = decimalIndex >= 0 ? normalized.slice(0, decimalIndex) : normalized
  const integer = integerSource.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, maxIntegerDigits)
  if (!fractionDigits || decimalIndex < 0) return integer
  const fraction = normalized.slice(decimalIndex + 1).replace(/\D/g, '').slice(0, fractionDigits)
  return `${integer || '0'}.${fraction}`
}

export function formatMoneyInput(value: string) {
  if (!value) return ''
  const [integer = '', fraction] = value.split('.')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

export function formatVietnameseMoneySummary(value: string) {
  const integer = value.split('.')[0]?.replace(/\D/g, '') ?? ''
  if (!integer) return ''
  let amount = BigInt(integer)
  if (amount === 0n) return '0 đồng'
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ']
  const groups: string[] = []
  let index = 0
  while (amount > 0n && index < units.length) {
    const group = amount % 1000n
    if (group > 0n) groups.unshift(`${group}${units[index] ? ` ${units[index]}` : ''}`)
    amount /= 1000n
    index += 1
  }
  return `${groups.join(' ')} đồng`
}

export function moneyInputToNumber(value: string) {
  return value ? Number(value) : 0
}
