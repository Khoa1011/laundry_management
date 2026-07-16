import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, readSession, writeSession } from './client'

describe('API client', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('adds the bearer token and selected branch without logging or exposing storage details', async () => {
    writeSession({ accessToken: 'test-token', expiresAt: Date.now() + 60_000, user: { id: 1, username: 'manager', displayName: 'Manager', roles: ['MANAGER'], permissions: ['customer.read'], branches: [{ id: 7, code: 'CN07', name: 'Branch 7' }], defaultBranchId: 7 } })
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    await apiRequest<{ ok: boolean }>('/api/test', { branchId: 7 })
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers)
    expect(headers.get('Authorization')).toBe('Bearer test-token')
    expect(headers.get('X-Branch-Id')).toBe('7')
  })

  it('clears an invalid session and returns a safe typed problem on 401', async () => {
    writeSession({ accessToken: 'expired-token', expiresAt: Date.now() + 60_000, user: { id: 1, username: 'manager', displayName: 'Manager', roles: [], permissions: [], branches: [], defaultBranchId: 1 } })
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: 401, errorCode: 'UNAUTHORIZED', detail: 'Sign in to continue.' }), { status: 401, headers: { 'Content-Type': 'application/problem+json' } }))
    await expect(apiRequest('/api/customers')).rejects.toMatchObject({ status: 401 })
    expect(readSession()).toBeNull()
  })

  it('maps a network failure without exposing the raw exception', async () => {
    vi.spyOn(window, 'fetch').mockRejectedValue(new Error('socket internals'))
    await expect(apiRequest('/api/customers')).rejects.toMatchObject({ status: 0, problem: { errorCode: 'NETWORK_ERROR' } })
  })
})
