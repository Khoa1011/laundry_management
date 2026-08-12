import type { TFunction } from 'i18next'
import { z } from 'zod'

const phonePattern = /^(?:\+?84|0)[2-9]\d{8}$/

export function employeeSchema(t: TFunction) {
  return z.object({
    fullName: z.string().trim().min(2, t('employee:validation.name')).max(150, t('employee:validation.name')),
    phone: z.string().trim().refine((value) => !value || phonePattern.test(value.replace(/[-\s.()]/g, '')), t('employee:validation.phone')),
    email: z.string().trim().refine((value) => !value || z.email().safeParse(value).success, t('employee:validation.email')),
    birthDate: z.string().refine((value) => !value || value <= new Date().toISOString().slice(0, 10), t('employee:validation.birthDate')),
    addressLine: z.string().trim().max(500, t('employee:validation.address')),
    administrativeVersion: z.enum(['', 'V1', 'V2']),
    province: z.string().max(120, t('employee:validation.address')),
    provinceCode: z.string(),
    district: z.string().max(120, t('employee:validation.address')),
    districtCode: z.string(),
    ward: z.string().max(120, t('employee:validation.address')),
    wardCode: z.string(),
    hireDate: z.string().min(1, t('employee:validation.hireDate')),
    positionId: z.coerce.number().positive(t('employee:validation.position')),
    status: z.enum(['ACTIVE', 'INACTIVE']),
    linkedUserId: z.union([z.coerce.number().positive(), z.literal('')]),
  })
}

export type EmployeeFormValues = z.input<ReturnType<typeof employeeSchema>>
