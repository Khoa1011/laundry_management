import { describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { addressSchema, customerSchema } from './schemas'

const base = {
  fullName: 'Nguyễn Minh Anh', phone: '0901 234 567', email: '', birthDate: '',
  customerType: 'INDIVIDUAL' as const, source: '' as const, note: '', includeAddress: false,
  differentReceiver: false, receiverName: '', receiverPhone: '', administrativeVersion: 'V2' as const,
  province: '', provinceCode: '', district: '', districtCode: '', ward: '', wardCode: '',
  addressLine: '', deliveryNote: '',
}

describe('customer form validation', () => {
  it('accepts supported Vietnamese phone formats', () => {
    expect(customerSchema(i18n.t).safeParse(base).success).toBe(true)
    expect(customerSchema(i18n.t).safeParse({ ...base, phone: '+84 901-234-567' }).success).toBe(true)
  })

  it('requires only an address line when delivery is enabled for the customer', () => {
    const result = customerSchema(i18n.t).safeParse({ ...base, includeAddress: true })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map((issue) => issue.path[0])).toEqual(['addressLine'])
    expect(customerSchema(i18n.t).safeParse({ ...base, includeAddress: true, addressLine: '12 Nguyễn Trãi' }).success).toBe(true)
  })

  it('requires receiver details only when a different receiver is selected', () => {
    const result = customerSchema(i18n.t).safeParse({ ...base, includeAddress: true, differentReceiver: true, addressLine: '12 Nguyễn Trãi' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(['receiverName', 'receiverPhone']))
  })

  it('rejects an inactive-format phone and empty address line', () => {
    const result = addressSchema(i18n.t).safeParse({
      receiverName: 'An', receiverPhone: '12345', administrativeVersion: 'V2',
      province: '', provinceCode: '', district: '', districtCode: '', ward: '', wardCode: '',
      addressLine: '', deliveryNote: '', isDefault: false,
    })
    expect(result.success).toBe(false)
  })
})
