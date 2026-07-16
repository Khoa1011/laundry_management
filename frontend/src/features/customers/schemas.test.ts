import { describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { addressSchema, customerSchema } from './schemas'

const base = { fullName: 'Nguyễn Minh Anh', phone: '0901 234 567', email: '', birthDate: '', customerType: 'INDIVIDUAL' as const, source: '' as const, note: '', includeAddress: false, receiverName: '', receiverPhone: '', province: '', district: '', ward: '', addressLine: '', deliveryNote: '' }

describe('customer form validation', () => {
  it('accepts supported Vietnamese phone formats', () => {
    expect(customerSchema(i18n.t).safeParse(base).success).toBe(true)
    expect(customerSchema(i18n.t).safeParse({ ...base, phone: '+84 901-234-567' }).success).toBe(true)
  })

  it('requires complete address fields only when initial address is enabled', () => {
    const result = customerSchema(i18n.t).safeParse({ ...base, includeAddress: true })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(['receiverName', 'receiverPhone', 'addressLine']))
  })

  it('rejects an inactive-format phone and empty address line', () => {
    const result = addressSchema(i18n.t).safeParse({ receiverName: 'An', receiverPhone: '12345', province: '', district: '', ward: '', addressLine: '', deliveryNote: '', isDefault: false })
    expect(result.success).toBe(false)
  })
})
