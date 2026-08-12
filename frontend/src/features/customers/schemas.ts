import { z } from 'zod'
import type { TFunction } from 'i18next'

const phonePattern = /^(?:(?:\+?84)|0)[\s.()-]*[35789](?:[\s.()-]*\d){8}$/

export function customerSchema(t: TFunction) {
  return z.object({
    fullName: z.string().trim().min(1, t('validation:fullNameRequired')).min(2, t('validation:fullNameLength')).max(150, t('validation:fullNameLength')),
    phone: z.string().trim().min(1, t('validation:phoneRequired')).regex(phonePattern, t('validation:phoneInvalid')),
    email: z.string().trim().refine((value) => !value || z.string().email().safeParse(value).success, t('validation:emailInvalid')),
    birthDate: z.string().refine((value) => !value || value <= new Date().toISOString().slice(0, 10), t('validation:birthFuture')),
    customerType: z.enum(['INDIVIDUAL', 'BUSINESS']),
    source: z.enum(['', 'WALK_IN', 'REFERRAL', 'FACEBOOK', 'ZALO', 'GOOGLE', 'WEBSITE', 'PARTNER', 'OTHER']),
    note: z.string().max(2000, t('validation:noteLength')),
    includeAddress: z.boolean(),
    differentReceiver: z.boolean(),
    receiverName: z.string().max(150, t('validation:maxLength')),
    receiverPhone: z.string(),
    administrativeVersion: z.enum(['', 'V1', 'V2']),
    province: z.string().max(120, t('validation:maxLength')),
    provinceCode: z.string(),
    district: z.string().max(120, t('validation:maxLength')),
    districtCode: z.string(),
    ward: z.string().max(120, t('validation:maxLength')),
    wardCode: z.string(),
    addressLine: z.string().max(500, t('validation:maxLength')),
    deliveryNote: z.string().max(1000, t('validation:maxLength')),
  }).superRefine((value, context) => {
    if (!value.includeAddress) return
    if (!value.addressLine.trim()) context.addIssue({ code: 'custom', path: ['addressLine'], message: t('validation:addressRequired') })
    if (!value.differentReceiver) return
    if (!value.receiverName.trim()) context.addIssue({ code: 'custom', path: ['receiverName'], message: t('validation:receiverRequired') })
    if (!phonePattern.test(value.receiverPhone.trim())) context.addIssue({ code: 'custom', path: ['receiverPhone'], message: t('validation:phoneInvalid') })
  })
}

export function addressSchema(t: TFunction) {
  return z.object({
    receiverName: z.string().trim().min(1, t('validation:receiverRequired')).max(150, t('validation:maxLength')),
    receiverPhone: z.string().trim().min(1, t('validation:phoneRequired')).regex(phonePattern, t('validation:phoneInvalid')),
    administrativeVersion: z.enum(['', 'V1', 'V2']),
    province: z.string().max(120, t('validation:maxLength')),
    provinceCode: z.string(),
    district: z.string().max(120, t('validation:maxLength')),
    districtCode: z.string(),
    ward: z.string().max(120, t('validation:maxLength')),
    wardCode: z.string(),
    addressLine: z.string().trim().min(1, t('validation:addressRequired')).max(500, t('validation:maxLength')),
    deliveryNote: z.string().max(1000, t('validation:maxLength')),
    isDefault: z.boolean(),
  })
}

export type CustomerFormValues = z.infer<ReturnType<typeof customerSchema>>
export type AddressFormValues = z.infer<ReturnType<typeof addressSchema>>
