export function formatVietnamAddress(address: {
  address?: string | null
  addressLine?: string | null
  ward?: string | null
  district?: string | null
  province?: string | null
}) {
  return [
    address.addressLine ?? address.address,
    address.ward,
    address.district,
    address.province,
  ].filter(Boolean).join(', ')
}
