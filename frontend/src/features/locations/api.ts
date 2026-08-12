import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../api/client'
import type { AdministrativeDivision, AdministrativeVersion } from './types'

const DAY = 24 * 60 * 60 * 1000

function useCatalogQuery(key: readonly unknown[], path: string, enabled: boolean) {
  return useQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiRequest<AdministrativeDivision[]>(path, { signal }),
    enabled,
    staleTime: DAY,
    gcTime: 7 * DAY,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useVietnamProvinces(version: AdministrativeVersion, enabled: boolean) {
  return useCatalogQuery(
    ['vietnam-locations', version, 'provinces'],
    `/api/locations/vietnam/${version.toLowerCase()}/provinces`,
    enabled && version !== '',
  )
}

export function useVietnamDistricts(provinceCode: string, enabled: boolean) {
  return useCatalogQuery(
    ['vietnam-locations', 'V1', 'districts', provinceCode],
    `/api/locations/vietnam/v1/provinces/${provinceCode}/districts`,
    enabled && provinceCode !== '',
  )
}

export function useVietnamWards(
  version: AdministrativeVersion,
  provinceCode: string,
  districtCode: string,
  enabled: boolean,
) {
  const parentCode = version === 'V1' ? districtCode : provinceCode
  const path = version === 'V1'
    ? `/api/locations/vietnam/v1/districts/${districtCode}/wards`
    : `/api/locations/vietnam/v2/provinces/${provinceCode}/wards`
  return useCatalogQuery(
    ['vietnam-locations', version, 'wards', parentCode],
    path,
    enabled && version !== '' && parentCode !== '',
  )
}
