const DATABASE_NAME = 'laundry-notification-audio'
const DATABASE_VERSION = 1
const STORE_NAME = 'custom-sounds'

export const MAX_CUSTOM_NOTIFICATION_SOUND_BYTES = 5 * 1024 * 1024
export const CUSTOM_NOTIFICATION_SOUND_ACCEPT = '.mp3,.wav,.ogg,.m4a,.aac,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac'

const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
])
const ALLOWED_EXTENSIONS = /\.(mp3|wav|ogg|m4a|aac)$/i

export type CustomNotificationSoundErrorCode =
  | 'UNSUPPORTED_BROWSER'
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'

export class CustomNotificationSoundError extends Error {
  constructor(public readonly code: CustomNotificationSoundErrorCode) {
    super(code)
  }
}

export interface CustomNotificationSoundRecord {
  scope: string
  blob: Blob
  fileName: string
  mimeType: string
  size: number
  updatedAt: number
  active: boolean
}

export function validateCustomNotificationSound(file: File) {
  const typeAllowed = file.type ? ALLOWED_MIME_TYPES.has(file.type.toLowerCase()) : false
  if (!typeAllowed && !ALLOWED_EXTENSIONS.test(file.name)) {
    throw new CustomNotificationSoundError('INVALID_FILE_TYPE')
  }
  if (file.size > MAX_CUSTOM_NOTIFICATION_SOUND_BYTES) {
    throw new CustomNotificationSoundError('FILE_TOO_LARGE')
  }
}

export async function loadCustomNotificationSound(scope: string) {
  return runRequest<CustomNotificationSoundRecord | undefined>('readonly', (store) => store.get(scope))
}

export async function saveCustomNotificationSound(scope: string, file: File) {
  validateCustomNotificationSound(file)
  const current = await loadCustomNotificationSound(scope).catch(() => undefined)
  const record: CustomNotificationSoundRecord = {
    scope,
    blob: file,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    updatedAt: Date.now(),
    active: current?.active ?? false,
  }
  await runRequest('readwrite', (store) => store.put(record))
  return record
}

export async function setCustomNotificationSoundActive(scope: string, active: boolean) {
  const record = await loadCustomNotificationSound(scope)
  if (!record) return undefined
  const updated = { ...record, active }
  await runRequest('readwrite', (store) => store.put(updated))
  return updated
}

export async function deleteCustomNotificationSound(scope: string) {
  await runRequest('readwrite', (store) => store.delete(scope))
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new CustomNotificationSoundError('UNSUPPORTED_BROWSER'))
  }
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'scope' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function runRequest<T>(
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const request = createRequest(transaction.objectStore(STORE_NAME))
    let result: T
    request.onsuccess = () => {
      result = request.result
    }
    request.onerror = () => reject(request.error)
    transaction.onabort = () => {
      database.close()
      reject(transaction.error)
    }
    transaction.oncomplete = () => {
      database.close()
      resolve(result)
    }
  })
}
