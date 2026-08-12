import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiRequest, logoutSession, readSession, refreshSession, writeSession } from '../api/client'
import type { CurrentUser, LoginResponse } from '../api/types'
import type { PermissionCode } from './permissionCodes.generated'

interface AuthContextValue {
  user: CurrentUser | null
  branchId: number | null
  sessionExpired: boolean
  isRestoring: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setBranchId: (branchId: number) => void
  hasPermission: (permission: PermissionCode) => boolean
  clearExpiredNotice: () => void
  refreshCurrentUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialSession] = useState(() => readSession())
  const [user, setUser] = useState<CurrentUser | null>(initialSession?.user ?? null)
  const [branchId, setBranchIdState] = useState<number | null>(initialSession?.user.defaultBranchId ?? null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [isRestoring, setIsRestoring] = useState(!initialSession)

  const logout = useCallback(async () => {
    await logoutSession()
    setUser(null)
    setBranchIdState(null)
  }, [])

  const applySession = useCallback((session: NonNullable<ReturnType<typeof readSession>>) => {
    setUser(session.user)
    setBranchIdState((selected) =>
      session.user.branches.some((branch) => branch.id === selected) ? selected : session.user.defaultBranchId)
    setSessionExpired(false)
  }, [])

  const refreshCurrentUser = useCallback(async () => {
    const session = readSession() ?? await refreshSession()
    if (!session) return
    const current = await apiRequest<Omit<CurrentUser, 'roles' | 'permissions'> & {
      effectivePermissions: CurrentUser['permissions']
    }>('/api/auth/me')
    const nextUser: CurrentUser = {
      ...session.user,
      ...current,
      roles: current.primaryRole ? [current.primaryRole.code] : [],
      permissions: [...current.effectivePermissions],
    }
    writeSession({ ...session, user: nextUser })
    setUser(nextUser)
    setBranchIdState((selected) =>
      nextUser.branches.some((branch) => branch.id === selected) ? selected : nextUser.defaultBranchId)
  }, [])

  useEffect(() => {
    const handleExpired = () => {
      setUser(null)
      setBranchIdState(null)
      setSessionExpired(true)
    }
    window.addEventListener('laundry:session-expired', handleExpired)
    return () => window.removeEventListener('laundry:session-expired', handleExpired)
  }, [])

  useEffect(() => {
    if (initialSession) {
      setIsRestoring(false)
      return
    }
    let active = true
    void refreshSession()
      .then((session) => {
        if (active && session) applySession(session)
      })
      .finally(() => {
        if (active) setIsRestoring(false)
      })
    return () => {
      active = false
    }
  }, [applySession, initialSession])

  useEffect(() => {
    const handleRefreshed = () => {
      const session = readSession()
      if (session) applySession(session)
    }
    window.addEventListener('laundry:session-refreshed', handleRefreshed)
    return () => window.removeEventListener('laundry:session-refreshed', handleRefreshed)
  }, [applySession])

  useEffect(() => {
    const refresh = () => { void refreshCurrentUser().catch(() => undefined) }
    if (readSession()) refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('laundry:authorization-stale', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('laundry:authorization-stale', refresh)
    }
  }, [refreshCurrentUser])

  const login = useCallback(async (username: string, password: string) => {
    const response = await apiRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
      skipAuthentication: true,
    })
    const nextUser = { ...response.user, permissions: [...response.user.permissions], roles: [...response.user.roles] }
    writeSession({
      accessToken: response.accessToken,
      expiresAt: Date.now() + response.expiresIn * 1000,
      user: nextUser,
    })
    setUser(nextUser)
    setBranchIdState(nextUser.defaultBranchId)
    setSessionExpired(false)
  }, [])

  const setBranchId = useCallback((nextBranchId: number) => {
    if (!user?.branches.some((branch) => branch.id === nextBranchId)) return
    setBranchIdState(nextBranchId)
  }, [user])

  const hasPermission = useCallback((permission: PermissionCode) => user?.permissions.includes(permission) ?? false, [user])
  const clearExpiredNotice = useCallback(() => setSessionExpired(false), [])
  const value = useMemo(() => ({
    user, branchId, sessionExpired, isRestoring, login, logout, setBranchId, hasPermission, clearExpiredNotice,
    refreshCurrentUser,
  }), [user, branchId, sessionExpired, isRestoring, login, logout, setBranchId, hasPermission, clearExpiredNotice, refreshCurrentUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
