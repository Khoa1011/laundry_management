import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

export const RISK_LEVELS = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
export const PERMISSION_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/
export const SUPPORTED_ROLES = new Set(['OWNER', 'MANAGER', 'RECEPTIONIST'])

export function constantName(code) {
  return code.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()
}

export async function loadCatalog(repoRoot) {
  const modulesDir = path.join(repoRoot, 'access-control', 'modules')
  const files = (await readdir(modulesDir))
    .filter((name) => name.endsWith('.yml') && !name.startsWith('_'))
    .sort()
  const manifests = []
  for (const file of files) {
    const filePath = path.join(modulesDir, file)
    let manifest
    try {
      manifest = JSON.parse(await readFile(filePath, 'utf8'))
    } catch (error) {
      throw new Error(`${path.relative(repoRoot, filePath)} is malformed: ${error.message}`)
    }
    manifests.push({ file, filePath, manifest })
  }
  return validateCatalog(manifests)
}

export function validateCatalog(manifests) {
  const errors = []
  const codes = new Map()
  const moduleCodes = new Set()
  const permissions = []

  for (const entry of manifests) {
    const { manifest, file } = entry
    const module = manifest?.module
    if (!module || typeof module !== 'object') {
      errors.push(`${file}: module metadata is required`)
      continue
    }
    for (const field of ['code', 'nameVi', 'nameEn', 'descriptionVi', 'descriptionEn']) {
      if (typeof module[field] !== 'string' || !module[field].trim()) {
        errors.push(`${file}: module.${field} is required`)
      }
    }
    if (!Number.isInteger(module.displayOrder) || module.displayOrder < 0) {
      errors.push(`${file}: module.displayOrder must be a non-negative integer`)
    }
    if (moduleCodes.has(module.code)) errors.push(`${file}: duplicate module code ${module.code}`)
    moduleCodes.add(module.code)
    if (!Array.isArray(manifest.permissions) || manifest.permissions.length === 0) {
      errors.push(`${file}: at least one permission is required`)
      continue
    }

    const localCodes = new Set()
    for (const permission of manifest.permissions) {
      const code = permission?.code
      if (!PERMISSION_PATTERN.test(code ?? '') || code.includes('*')) {
        errors.push(`${file}: invalid permission code ${String(code)}`)
      }
      if (typeof code === 'string' && !code.startsWith(`${module.code}.`)) {
        errors.push(`${file}: permission ${code} must belong to module ${module.code}`)
      }
      for (const field of ['resource', 'action', 'nameVi', 'nameEn', 'descriptionVi', 'descriptionEn']) {
        if (typeof permission?.[field] !== 'string' || !permission[field].trim()) {
          errors.push(`${file}: ${code ?? '<unknown>'}.${field} is required`)
        }
      }
      if (!RISK_LEVELS.has(permission?.riskLevel)) {
        errors.push(`${file}: ${code ?? '<unknown>'} has invalid risk level ${String(permission?.riskLevel)}`)
      }
      if (!Number.isInteger(permission?.displayOrder) || permission.displayOrder < 0) {
        errors.push(`${file}: ${code ?? '<unknown>'}.displayOrder must be a non-negative integer`)
      }
      if (localCodes.has(code) || codes.has(code)) {
        errors.push(`${file}: duplicate permission code ${code}`)
      }
      localCodes.add(code)
      codes.set(code, file)
      permissions.push({ ...permission, module: module.code })
    }

    if (!manifest.defaultRoleGrants || typeof manifest.defaultRoleGrants !== 'object' || Array.isArray(manifest.defaultRoleGrants)) {
      errors.push(`${file}: defaultRoleGrants is required`)
    } else {
      for (const [role, grants] of Object.entries(manifest.defaultRoleGrants)) {
        if (!SUPPORTED_ROLES.has(role)) errors.push(`${file}: unsupported default role ${role}`)
        if (!Array.isArray(grants)) {
          errors.push(`${file}: grants for ${role} must be an array`)
          continue
        }
        for (const grant of grants) {
          if (!localCodes.has(grant)) errors.push(`${file}: ${role} references unknown permission ${grant}`)
        }
      }
    }
  }

  const customerCodes = new Set(permissions.filter((item) => item.module === 'customer').map((item) => item.code))
  for (const required of [
    'customer.read',
    'customer.create',
    'customer.update',
    'customer.deactivate',
    'customer.address.manage',
    'customer.audit.read',
  ]) {
    if (!customerCodes.has(required)) errors.push(`Customer permission is not registered: ${required}`)
  }

  if (errors.length > 0) throw new Error(errors.join('\n'))
  return {
    manifests: [...manifests].sort((a, b) =>
      a.manifest.module.displayOrder - b.manifest.module.displayOrder
      || a.manifest.module.code.localeCompare(b.manifest.module.code)),
    permissions: permissions.sort((a, b) =>
      a.module.localeCompare(b.module)
      || a.displayOrder - b.displayOrder
      || a.code.localeCompare(b.code)),
  }
}

export function renderJava(catalog) {
  const lines = catalog.permissions.map((permission) =>
    `    public static final String ${constantName(permission.code)} = "${permission.code}";`)
  return `// GENERATED FILE - DO NOT EDIT MANUALLY.
// Source: access-control/modules/*.yml
package com.laundry.management.auth.security.permission;

public final class PermissionCodes {

    private PermissionCodes() {
    }

${lines.join('\n')}
}
`
}

export function renderTypeScript(catalog) {
  const lines = catalog.permissions.map((permission) =>
    `  ${constantName(permission.code)}: '${permission.code}',`)
  return `// GENERATED FILE - DO NOT EDIT MANUALLY.
// Source: access-control/modules/*.yml
export const PERMISSION_CODES = {
${lines.join('\n')}
} as const

export type PermissionCode = typeof PERMISSION_CODES[keyof typeof PERMISSION_CODES]

export const ALL_PERMISSION_CODES: readonly PermissionCode[] = Object.values(PERMISSION_CODES)
`
}

export function generatedOutputs(repoRoot, catalog) {
  return new Map([
    [
      path.join(repoRoot, 'backend', 'src', 'main', 'java', 'com', 'laundry', 'management', 'auth', 'security', 'permission', 'PermissionCodes.java'),
      renderJava(catalog),
    ],
    [
      path.join(repoRoot, 'frontend', 'src', 'auth', 'permissionCodes.generated.ts'),
      renderTypeScript(catalog),
    ],
  ])
}

async function filesRecursively(directory, extensions) {
  const result = []
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return result
  }
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await filesRecursively(fullPath, extensions))
    else if (extensions.some((extension) => entry.name.endsWith(extension))) result.push(fullPath)
  }
  return result
}

export async function scanPermissionReferences(repoRoot, catalog) {
  const knownCodes = new Set(catalog.permissions.map((permission) => permission.code))
  const constantCodes = new Map(catalog.permissions.map((permission) => [constantName(permission.code), permission.code]))
  const findings = []
  const unknown = []
  const roots = [
    [path.join(repoRoot, 'backend', 'src', 'main', 'java'), ['.java']],
    [path.join(repoRoot, 'frontend', 'src'), ['.ts', '.tsx']],
  ]
  for (const [root, extensions] of roots) {
    for (const file of await filesRecursively(root, extensions)) {
      if (file.endsWith('PermissionCodes.java') || file.endsWith('permissionCodes.generated.ts')) continue
      const source = await readFile(file, 'utf8')
      const relative = path.relative(repoRoot, file)
      for (const match of source.matchAll(/hasAuthority\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        if (!knownCodes.has(match[1])) unknown.push(`${relative}: unknown backend permission ${match[1]}`)
      }
      for (const match of source.matchAll(/hasPermission\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        if (!knownCodes.has(match[1])) unknown.push(`${relative}: unknown frontend permission ${match[1]}`)
      }
      for (const match of source.matchAll(/PermissionCodes\.([A-Z0-9_]+)/g)) {
        if (!constantCodes.has(match[1])) unknown.push(`${relative}: unknown backend permission constant ${match[1]}`)
      }
      for (const match of source.matchAll(/PERMISSION_CODES\.([A-Z0-9_]+)/g)) {
        if (!constantCodes.has(match[1])) unknown.push(`${relative}: unknown frontend permission constant ${match[1]}`)
      }
      const bypassPatterns = [
        [/\bhasRole\s*\(\s*["']ADMIN["']/g, 'hasRole ADMIN'],
        [/\bhasAnyRole\s*\([^)]*["']ADMIN["']/g, 'hasAnyRole ADMIN'],
        [/\bROLE_ADMIN\b/g, 'ROLE_ADMIN'],
        [/\brole\s*={2,3}\s*["'](?:ADMIN|MANAGER)["']/g, 'frontend role-name authorization'],
        [/\bisAdmin\b/g, 'isAdmin'],
        [/\bshowEverything\b/g, 'showEverything'],
      ]
      for (const [pattern, label] of bypassPatterns) {
        if (pattern.test(source)) findings.push(`${relative}: potential ${label} bypass`)
      }
    }
  }
  return { unknown, bypassFindings: findings }
}
