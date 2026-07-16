import type { ApiProblem } from './types'

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

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  branchId?: number
  skipAuthentication?: boolean
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const session = readSession()
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (!options.skipAuthentication && session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`)
  }
  if (options.branchId) headers.set('X-Branch-Id', String(options.branchId))

  let response: Response
  try {
    response = await fetch(path, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
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
    if (response.status === 401 && !options.skipAuthentication) clearSession('expired')
    throw new ApiError(response.status, problem)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
