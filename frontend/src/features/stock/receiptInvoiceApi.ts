import { useTranslation } from 'react-i18next'
import { ApiError, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES as P } from '../../auth/permissionCodes.generated'

export type ImageMetadata = { id: string; originalName: string; contentType: string; version: number; status: string }
export type Listing = { files: ImageMetadata[]; storageReady: boolean }
export type PendingInvoiceImage = { file: File; command: string }
const preparedPhotos = new WeakMap<File, Promise<Blob>>()

export function invoiceEndpoint(documentId: number, branchId: number, suffix = '') {
  return `/api/inventory/documents/${documentId}/invoice-images${suffix}?branchId=${branchId}`
}

export async function uploadInvoiceImage(documentId: number, branchId: number, image: PendingInvoiceImage, replaces?: string) {
  const body = new FormData()
  let prepared = preparedPhotos.get(image.file)
  if (!prepared) {
    prepared = optimizePhoto(image.file)
    preparedPhotos.set(image.file, prepared)
  }
  body.append('file', await prepared, image.file.name)
  return apiRequest<ImageMetadata>(invoiceEndpoint(documentId, branchId, replaces ? `/${replaces}/replace` : ''), {
    method: 'POST', branchId, body, headers: { 'Idempotency-Key': image.command },
  })
}

async function optimizePhoto(file: File): Promise<Blob> {
  if (file.size < 1024 * 1024 || !['image/jpeg', 'image/webp'].includes(file.type)
    || typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file)
    try {
      // Retain the original dimensions so small print stays legible.
      if (bitmap.width * bitmap.height > 25_000_000) return file
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) return file
      context.drawImage(bitmap, 0, 0)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, 0.94))
      return blob?.type === file.type && blob.size < file.size ? blob : file
    } finally {
      bitmap.close()
    }
  } catch {
    return file
  }
}

export function useReceiptInvoicePermissions() {
  const { hasPermission } = useAuth()
  const allowed = hasPermission(P.INVENTORY_DOCUMENT_READ) && hasPermission(P.INVENTORY_COST_READ)
  return {
    read: allowed && hasPermission(P.INVENTORY_INVOICE_READ),
    upload: allowed && hasPermission(P.INVENTORY_INVOICE_UPLOAD),
    remove: allowed && hasPermission(P.INVENTORY_INVOICE_DELETE),
  }
}

export function useInvoiceError() {
  const { t } = useTranslation('stock')
  return (error: unknown) => {
    if (error instanceof ApiError) {
      if (error.status === 403) return t('invoice.denied')
      if (error.status === 413) return t('invoice.tooLarge')
      if (error.status === 415) return t('invoice.invalid')
      if (error.status === 409) return t('invoice.changed')
      if (error.problem.errorCode === 'INVENTORY_INVOICE_STORAGE_NOT_CONFIGURED') return t('invoice.unconfigured')
    }
    return t('invoice.failed')
  }
}
