import type { ApiProblem, LoginResponse } from './types'

const SESSION_KEY = 'laundry.session'

export interface StoredSession {
  accessToken: string
  expiresAt: number
  user: import('./types').CurrentUser
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: ApiProblem,
  ) {
    super(problem.detail ?? problem.title ?? 'API request failed')
  }
}

export function readSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as StoredSession
    if (!session.accessToken || session.expiresAt <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function writeSession(session: StoredSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(reason?: 'expired') {
  sessionStorage.removeItem(SESSION_KEY)
  if (reason === 'expired') window.dispatchEvent(new Event('laundry:session-expired'))
}

let refreshInFlight: Promise<StoredSession | null> | null = null
let logoutInProgress = false

export function refreshSession(): Promise<StoredSession | null> {
  if (logoutInProgress) return Promise.resolve(null)
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    let response: Response
    try {
      response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
    } catch {
      return null
    }
    if (!response.ok) {
      clearSession()
      return null
    }
    const refreshed = (await response.json()) as LoginResponse
    const session: StoredSession = {
      accessToken: refreshed.accessToken,
      expiresAt: Date.now() + refreshed.expiresIn * 1000,
      user: {
        ...refreshed.user,
        permissions: [...refreshed.user.permissions],
        roles: [...refreshed.user.roles],
      },
    }
    writeSession(session)
    window.dispatchEvent(new Event('laundry:session-refreshed'))
    return session
  })().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

export async function logoutSession() {
  logoutInProgress = true
  try {
    await refreshInFlight?.catch(() => null)
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
  } finally {
    clearSession()
    logoutInProgress = false
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  branchId?: number
  skipAuthentication?: boolean
}

async function apiRequestInternal<T>(path: string, options: RequestOptions, retried: boolean): Promise<T> {
  const session = readSession()
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (options.body !== undefined && !isFormData) headers.set('Content-Type', 'application/json')
  if (!options.skipAuthentication && session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`)
  }
  if (options.branchId) headers.set('X-Branch-Id', String(options.branchId))

  let response: Response
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers,
      body: options.body === undefined ? undefined : isFormData ? options.body as FormData : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, { status: 0, errorCode: 'NETWORK_ERROR' })
  }

  if (!response.ok) {
    let problem: ApiProblem = { status: response.status }
    try {
      problem = (await response.json()) as ApiProblem
    } catch {
      // Keep a safe, status-only problem when an intermediary returns non-JSON.
    }
    if (response.status === 401 && !options.skipAuthentication && !retried) {
      const refreshed = await refreshSession()
      if (refreshed) return apiRequestInternal<T>(path, options, true)
      clearSession('expired')
    } else if (response.status === 401 && !options.skipAuthentication) {
      clearSession('expired')
    }
    if (problem.errorCode === 'AUTHORIZATION_CONTEXT_STALE') {
      window.dispatchEvent(new Event('laundry:authorization-stale'))
    }
    throw new ApiError(response.status, problem)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return apiRequestInternal<T>(path, options, false)
}

async function apiRequestBlobInternal(
  path: string,
  options: Omit<RequestOptions, 'body'>,
  retried: boolean,
): Promise<Blob> {
  const session = readSession()
  const headers = new Headers(options.headers)
  headers.set('Accept', 'image/jpeg,image/png,application/pdf')
  if (!options.skipAuthentication && session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`)
  }
  if (options.branchId) headers.set('X-Branch-Id', String(options.branchId))
  let response: Response
  try {
    response = await fetch(path, { ...options, credentials: 'same-origin', headers })
  } catch {
    throw new ApiError(0, { status: 0, errorCode: 'NETWORK_ERROR' })
  }
  if (!response.ok) {
    let problem: ApiProblem = { status: response.status }
    try { problem = (await response.json()) as ApiProblem } catch { /* Keep status-only problem. */ }
    if (response.status === 401 && !options.skipAuthentication && !retried) {
      const refreshed = await refreshSession()
      if (refreshed) return apiRequestBlobInternal(path, options, true)
      clearSession('expired')
    } else if (response.status === 401 && !options.skipAuthentication) {
      clearSession('expired')
    }
    if (problem.errorCode === 'AUTHORIZATION_CONTEXT_STALE') {
      window.dispatchEvent(new Event('laundry:authorization-stale'))
    }
    throw new ApiError(response.status, problem)
  }
  return response.blob()
}

export async function apiRequestBlob(path: string, options: Omit<RequestOptions, 'body'> = {}): Promise<Blob> {
  return apiRequestBlobInternal(path, options, false)
}
