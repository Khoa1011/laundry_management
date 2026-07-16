import type { TFunction } from 'i18next'
import type { CustomerSource, CustomerStatus, CustomerType } from '../../api/types'

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part.charAt(0).toLocaleUpperCase()).join('') || '—'
}

export function formatDate(value: string | null | undefined, language: string, withTime = false) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'vi-VN', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(new Date(value))
}

export function sourceLabel(source: CustomerSource | null | undefined, t: TFunction) {
  if (!source) return t('unknown')
  const keys: Record<CustomerSource, string> = { WALK_IN: 'walkIn', REFERRAL: 'referral', FACEBOOK: 'facebook', ZALO: 'zalo', GOOGLE: 'google', WEBSITE: 'website', PARTNER: 'partner', OTHER: 'other' }
  return t(`customers:${keys[source]}`)
}

export function statusLabel(status: CustomerStatus, t: TFunction) {
  return status === 'ACTIVE' ? t('active') : t('inactive')
}

export function typeLabel(type: CustomerType, t: TFunction) {
  return type === 'INDIVIDUAL' ? t('individual') : t('business')
}

export function formatAddress(address: { addressLine: string; ward?: string | null; district?: string | null; province?: string | null }) {
  return [address.addressLine, address.ward, address.district, address.province].filter(Boolean).join(', ')
}
