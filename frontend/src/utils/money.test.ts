import { describe, expect, it } from 'vitest'
import { formatMoneyInput, formatVietnameseMoneySummary, moneyInputToNumber, sanitizeMoneyInput } from './money'

describe('shared money input utilities', () => {
  it('normalizes pasted separators and formats thousands consistently', () => {
    expect(sanitizeMoneyInput('1,250,000 đ')).toBe('1250000')
    expect(formatMoneyInput('1250000')).toBe('1,250,000')
  })

  it('keeps a configured decimal fraction without mixing it with thousands separators', () => {
    expect(sanitizeMoneyInput('1,234.567', { fractionDigits: 2 })).toBe('1234.56')
    expect(formatMoneyInput('1234.56')).toBe('1,234.56')
  })

  it('creates the compact Vietnamese amount label used across business forms', () => {
    expect(formatVietnameseMoneySummary('1000000')).toBe('1 triệu đồng')
    expect(formatVietnameseMoneySummary('1250000')).toBe('1 triệu 250 nghìn đồng')
    expect(formatVietnameseMoneySummary('1250500')).toBe('1 triệu 250 nghìn 500 đồng')
  })

  it('converts the canonical value for API payloads', () => {
    expect(moneyInputToNumber('1250000')).toBe(1_250_000)
  })
})
