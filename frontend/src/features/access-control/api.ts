import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../../api/client'
import type { AuditPage, PermissionModule, Role, RoleMatrix, RolePage, UserAccess, UserPage } from './types'

const params = (values: Record<string, string | number | boolean | undefined>) => {
  const result = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') result.set(key, String(value))
  })
  return result.toString()
}

export function usePermissionModules(enabled = true) {
  return useQuery({
    queryKey: ['access-permissions-grouped'],
    queryFn: ({ signal }) => apiRequest<PermissionModule[]>('/api/access/permissions/grouped', { signal }),
    enabled,
    staleTime: 60_000,
  })
}

export function useRoles(search = '', size = 50, enabled = true) {
  return useQuery({
    queryKey: ['access-roles', search, size],
    queryFn: ({ signal }) => apiRequest<RolePage>(`/api/access/roles?${params({ search, size, sort: 'displayName,asc' })}`, { signal }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

export function useRole(roleId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['access-role', roleId],
    queryFn: ({ signal }) => apiRequest<Role>(`/api/access/roles/${roleId}`, { signal }),
    enabled: enabled && roleId !== null,
  })
}

export function useRoleMatrix(roleId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['access-role-matrix', roleId],
    queryFn: ({ signal }) => apiRequest<RoleMatrix>(`/api/access/roles/${roleId}/permissions`, { signal }),
    enabled: enabled && roleId !== null,
  })
}

export function useUsers(search = '', enabled = true) {
  return useQuery({
    queryKey: ['access-users', search],
    queryFn: ({ signal }) => apiRequest<UserPage>(`/api/access/users?${params({ search, size: 50, sort: 'displayName,asc' })}`, { signal }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

export function useRoleUsers(roleId: number | null, page = 0, enabled = true) {
  return useQuery({
    queryKey: ['access-role-users', roleId, page],
    queryFn: ({ signal }) => apiRequest<UserPage>(`/api/access/users?${params({
      roleId: roleId ?? undefined,
      page,
      size: 20,
      sort: 'displayName,asc',
    })}`, { signal }),
    enabled: enabled && roleId !== null,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

export function useUserAccess(userId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['access-user', userId],
    queryFn: ({ signal }) => apiRequest<UserAccess>(`/api/access/users/${userId}`, { signal }),
    enabled: enabled && userId !== null,
  })
}

export function useAccessAudit(enabled = true) {
  return useQuery({
    queryKey: ['access-audit'],
    queryFn: ({ signal }) => apiRequest<AuditPage>('/api/access/audit?page=0&size=50&sort=createdAt,desc', { signal }),
    enabled,
    staleTime: 10_000,
  })
}

export function useRoleAudit(roleId: number | null, page = 0, enabled = true) {
  return useQuery({
    queryKey: ['access-role-audit', roleId, page],
    queryFn: ({ signal }) => apiRequest<AuditPage>(`/api/access/audit?${params({
      targetType: 'ROLE',
      targetId: roleId ?? undefined,
      page,
      size: 20,
      sort: 'createdAt,desc',
    })}`, { signal }),
    enabled: enabled && roleId !== null,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })
}

export function useAccessMutations() {
  const client = useQueryClient()
  const invalidateRoles = () => {
    void client.invalidateQueries({ queryKey: ['access-roles'] })
    void client.invalidateQueries({ queryKey: ['access-role'] })
    void client.invalidateQueries({ queryKey: ['access-role-matrix'] })
    void client.invalidateQueries({ queryKey: ['access-role-users'] })
    void client.invalidateQueries({ queryKey: ['access-role-audit'] })
    void client.invalidateQueries({ queryKey: ['access-audit'] })
  }
  const invalidateUsers = () => {
    void client.invalidateQueries({ queryKey: ['access-users'] })
    void client.invalidateQueries({ queryKey: ['access-user'] })
    void client.invalidateQueries({ queryKey: ['access-audit'] })
  }
  return {
    createRole: useMutation({
      mutationFn: (body: unknown) => apiRequest<Role>('/api/access/roles', { method: 'POST', body }),
      onSuccess: invalidateRoles,
    }),
    updateRole: useMutation({
      mutationFn: ({ roleId, body }: { roleId: number; body: unknown }) =>
        apiRequest<Role>(`/api/access/roles/${roleId}`, { method: 'PUT', body }),
      onSuccess: invalidateRoles,
    }),
    cloneRole: useMutation({
      mutationFn: ({ roleId, body }: { roleId: number; body: unknown }) =>
        apiRequest<Role>(`/api/access/roles/${roleId}/clone`, { method: 'POST', body }),
      onSuccess: invalidateRoles,
    }),
    changeRoleStatus: useMutation({
      mutationFn: ({ roleId, body }: { roleId: number; body: unknown }) =>
        apiRequest<Role>(`/api/access/roles/${roleId}/status`, { method: 'PATCH', body }),
      onSuccess: invalidateRoles,
    }),
    saveMatrix: useMutation({
      mutationFn: ({ roleId, body }: { roleId: number; body: unknown }) =>
        apiRequest<RoleMatrix>(`/api/access/roles/${roleId}/permissions`, { method: 'PUT', body }),
      onSuccess: invalidateRoles,
    }),
    assignRole: useMutation({
      mutationFn: ({ userId, body }: { userId: number; body: unknown }) =>
        apiRequest<UserAccess>(`/api/access/users/${userId}/role`, { method: 'PUT', body }),
      onSuccess: invalidateUsers,
    }),
    saveOverrides: useMutation({
      mutationFn: ({ userId, body }: { userId: number; body: unknown }) =>
        apiRequest<UserAccess>(`/api/access/users/${userId}/overrides`, { method: 'PUT', body }),
      onSuccess: invalidateUsers,
    }),
  }
}
