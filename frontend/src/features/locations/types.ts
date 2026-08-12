export type AdministrativeVersion = '' | 'V1' | 'V2'

export interface AdministrativeDivision {
  code: number
  name: string
  divisionType: string
}

export interface VietnamAddressValue {
  administrativeVersion: AdministrativeVersion
  province: string
  provinceCode: string
  district: string
  districtCode: string
  ward: string
  wardCode: string
  addressLine: string
}

export type VietnamAddressErrors = Partial<Record<keyof VietnamAddressValue, string>>
