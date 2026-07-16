import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiRequest, clearSession, readSession, writeSession } from '../api/client'
import type { CurrentUser, LoginResponse } from '../api/types'

interface AuthContextValue {
  user: CurrentUser | null
  branchId: number | null
  sessionExpired: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  setBranchId: (branchId: number) => void
  hasPermission: (permission: string) => boolean
  clearExpiredNotice: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialSession = readSession()
  const [user, setUser] = useState<CurrentUser | null>(initialSession?.user ?? null)
  const [branchId, setBranchIdState] = useState<number | null>(initialSession?.user.defaultBranchId ?? null)
  const [sessionExpired, setSessionExpired] = useState(false)

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    setBranchIdState(null)
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

  const hasPermission = useCallback((permission: string) => user?.permissions.includes(permission) ?? false, [user])
  const clearExpiredNotice = useCallback(() => setSessionExpired(false), [])
  const value = useMemo(() => ({ user, branchId, sessionExpired, login, logout, setBranchId, hasPermission, clearExpiredNotice }), [user, branchId, sessionExpired, login, logout, setBranchId, hasPermission, clearExpiredNotice])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
