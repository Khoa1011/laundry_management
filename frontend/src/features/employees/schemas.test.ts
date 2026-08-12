import { describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { employeeSchema } from './schemas'

const base = {
  fullName: 'Nguyen Minh Anh',
  phone: '0901 234 567',
  email: 'anh@example.test',
  birthDate: '1995-03-12',
  addressLine: '12 Nguyen Trai',
  administrativeVersion: '' as const,
  province: '',
  provinceCode: '',
  district: '',
  districtCode: '',
  ward: '',
  wardCode: '',
  hireDate: '2026-07-01',
  positionId: 1,
  status: 'ACTIVE' as const,
  linkedUserId: '',
}

describe('employee form validation', () => {
  it('accepts supported Vietnamese phone formats and an optional account', () => {
    expect(employeeSchema(i18n.t).safeParse(base).success).toBe(true)
    expect(employeeSchema(i18n.t).safeParse({ ...base, phone: '+84 901-234-567', linkedUserId: 9 }).success).toBe(true)
  })

  it('rejects future birth dates and an unavailable position', () => {
    const result = employeeSchema(i18n.t).safeParse({ ...base, birthDate: '2999-01-01', positionId: 0 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(['birthDate', 'positionId']))
    }
  })

  it('allows phone and email to remain empty', () => {
    expect(employeeSchema(i18n.t).safeParse({ ...base, phone: '', email: '' }).success).toBe(true)
  })
})
