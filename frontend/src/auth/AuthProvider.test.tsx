import { act, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentUser } from '../api/types'
import { AuthProvider, useAuth } from './AuthProvider'
import type { BranchChangeRequest } from './branchChangeGuards'

const stableUser: CurrentUser = {
  id: 1,
  username: 'admin',
  displayName: 'Admin',
  roles: ['ADMIN'],
  permissions: [],
  branches: [{ id: 1, code: 'MAIN', name: 'Chi nhánh chính' }],
  defaultBranchId: 1,
  authorizationVersion: 1,
  status: 'ACTIVE',
  primaryRole: {
    id: 1,
    code: 'ADMIN',
    nameVi: 'Quản trị viên',
    nameEn: 'Administrator',
    status: 'ACTIVE',
    system: true,
  },
}

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  readSession: vi.fn(),
  refreshSession: vi.fn(),
  writeSession: vi.fn(),
  logoutSession: vi.fn(),
}))

vi.mock('../api/client', () => ({
  apiRequest: mocks.apiRequest,
  readSession: mocks.readSession,
  refreshSession: mocks.refreshSession,
  writeSession: mocks.writeSession,
  logoutSession: mocks.logoutSession,
}))

function Probe() {
  const { user } = useAuth()
  return <span>{user?.displayName}</span>
}

function GuardedBranchProbe() {
  const { branchId, setBranchId, registerBranchChangeGuard } = useAuth()
  const [request, setRequest] = useState<BranchChangeRequest | null>(null)
  useEffect(() => registerBranchChangeGuard(setRequest), [registerBranchChangeGuard])
  return <><span data-testid="selected-branch">{branchId}</span>
    <button onClick={() => setBranchId(2)}>switch</button><button onClick={() => setBranchId(99)}>forbidden</button>
    {request && <><button onClick={() => setRequest(null)}>cancel</button><button onClick={() => { request.proceed(); setRequest(null) }}>continue</button></>}
  </>
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-11T10:00:00Z'))
    mocks.apiRequest.mockReset().mockResolvedValue({
      ...stableUser,
      effectivePermissions: stableUser.permissions,
    })
    mocks.readSession.mockReset().mockReturnValue({
      accessToken: 'test-token',
      expiresAt: Date.now() + 60_000,
      user: stableUser,
    })
    mocks.refreshSession.mockReset()
    mocks.writeSession.mockReset()
    mocks.logoutSession.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces rapid focus refreshes and refreshes again after the cooldown', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(mocks.apiRequest).toHaveBeenCalledTimes(1)

    act(() => {
      for (let index = 0; index < 20; index += 1) window.dispatchEvent(new Event('focus'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(mocks.apiRequest).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1_500)
    act(() => window.dispatchEvent(new Event('focus')))
    await act(async () => {
      await Promise.resolve()
    })
    expect(mocks.apiRequest).toHaveBeenCalledTimes(2)
  })

  it('guards a permitted branch change without weakening branch membership checks', async () => {
    const user = { ...stableUser, branches: [...stableUser.branches, { id: 2, code: 'SECOND', name: 'Chi nhánh hai' }] }
    mocks.readSession.mockReturnValue({ accessToken: 'test-token', expiresAt: Date.now() + 60_000, user })
    mocks.apiRequest.mockResolvedValue({ ...user, effectivePermissions: [] })
    render(<AuthProvider><GuardedBranchProbe /></AuthProvider>)
    await act(async () => { await Promise.resolve() })
    act(() => screen.getByText('forbidden').click())
    expect(screen.queryByText('continue')).not.toBeInTheDocument()
    act(() => screen.getByText('switch').click())
    expect(screen.getByTestId('selected-branch')).toHaveTextContent('1')
    act(() => screen.getByText('cancel').click())
    expect(screen.getByTestId('selected-branch')).toHaveTextContent('1')
    act(() => screen.getByText('switch').click())
    act(() => screen.getByText('continue').click())
    expect(screen.getByTestId('selected-branch')).toHaveTextContent('2')
  })
})
