import type { VietnamAddressValue } from './types'

export function toVietnamAddressPayload(value: VietnamAddressValue) {
  return {
    administrativeVersion: value.administrativeVersion || undefined,
    province: value.province || undefined,
    provinceCode: value.provinceCode ? Number(value.provinceCode) : undefined,
    district: value.district || undefined,
    districtCode: value.districtCode ? Number(value.districtCode) : undefined,
    ward: value.ward || undefined,
    wardCode: value.wardCode ? Number(value.wardCode) : undefined,
  }
}
