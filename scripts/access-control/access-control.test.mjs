import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { checkGenerated } from './check-generated-permissions.mjs'
import { generate } from './generate-permissions.mjs'
import { scanPermissionReferences, validateCatalog } from './lib.mjs'

function permission(overrides = {}) {
  return {
    code: 'customer.read',
    resource: 'customer',
    action: 'read',
    nameVi: 'Xem khách hàng',
    nameEn: 'View customers',
    descriptionVi: 'Mô tả tiếng Việt',
    descriptionEn: 'English description',
    riskLevel: 'LOW',
    displayOrder: 10,
    ...overrides,
  }
}

function manifest(overrides = {}) {
  const permissions = overrides.permissions ?? [
    permission(),
    permission({ code: 'customer.create', action: 'create', displayOrder: 20 }),
    permission({ code: 'customer.update', action: 'update', displayOrder: 30 }),
    permission({ code: 'customer.deactivate', action: 'deactivate', riskLevel: 'HIGH', displayOrder: 40 }),
    permission({ code: 'customer.address.manage', resource: 'customer.address', action: 'manage', displayOrder: 50 }),
    permission({ code: 'customer.audit.read', resource: 'customer.audit', action: 'read', riskLevel: 'HIGH', displayOrder: 60 }),
  ]
  return {
    module: {
      code: 'customer',
      nameVi: 'Khách hàng',
      nameEn: 'Customers',
      descriptionVi: 'Mô tả',
      descriptionEn: 'Description',
      displayOrder: 10,
    },
    permissions,
    defaultRoleGrants: { OWNER: permissions.map((item) => item.code) },
    ...overrides,
    permissions,
  }
}

function catalogOf(value) {
  return validateCatalog([{ file: 'customer.yml', filePath: 'customer.yml', manifest: value }])
}

test('valid customer manifest is deterministic', () => {
  const catalog = catalogOf(manifest())
  assert.equal(catalog.permissions.length, 6)
  assert.deepEqual(catalog.permissions.map((item) => item.code), [
    'customer.read',
    'customer.create',
    'customer.update',
    'customer.deactivate',
    'customer.address.manage',
    'customer.audit.read',
  ])
})

for (const [name, mutate, expected] of [
  ['duplicate permission code', (value) => value.permissions.push({ ...value.permissions[0] }), 'duplicate permission code'],
  ['invalid code format', (value) => { value.permissions[0].code = 'CUSTOMER_READ' }, 'invalid permission code'],
  ['missing Vietnamese name', (value) => { value.permissions[0].nameVi = '' }, 'nameVi is required'],
  ['missing English name', (value) => { value.permissions[0].nameEn = '' }, 'nameEn is required'],
  ['invalid risk level', (value) => { value.permissions[0].riskLevel = 'SEVERE' }, 'invalid risk level'],
  ['unknown default role grant', (value) => { value.defaultRoleGrants.OWNER.push('customer.unknown') }, 'references unknown permission'],
]) {
  test(`rejects ${name}`, () => {
    const value = structuredClone(manifest())
    mutate(value)
    assert.throws(() => catalogOf(value), new RegExp(expected))
  })
}

test('generates Java and TypeScript constants and detects drift', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'laundry-permissions-'))
  try {
    const modules = path.join(root, 'access-control', 'modules')
    await mkdir(modules, { recursive: true })
    await writeFile(path.join(modules, 'customer.yml'), JSON.stringify(manifest()), 'utf8')
    await generate(root)
    const java = await readFile(path.join(root, 'backend', 'src', 'main', 'java', 'com', 'laundry', 'management', 'auth', 'security', 'permission', 'PermissionCodes.java'), 'utf8')
    const typescript = await readFile(path.join(root, 'frontend', 'src', 'auth', 'permissionCodes.generated.ts'), 'utf8')
    assert.match(java, /CUSTOMER_READ = "customer\.read"/)
    assert.match(typescript, /CUSTOMER_READ: 'customer\.read'/)
    await checkGenerated(root)
    await writeFile(path.join(root, 'frontend', 'src', 'auth', 'permissionCodes.generated.ts'), '// drift\n', 'utf8')
    await assert.rejects(checkGenerated(root), /out of sync/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('reports unknown backend and frontend permission references', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'laundry-permission-refs-'))
  try {
    const backend = path.join(root, 'backend', 'src', 'main', 'java')
    const frontend = path.join(root, 'frontend', 'src')
    await mkdir(backend, { recursive: true })
    await mkdir(frontend, { recursive: true })
    await writeFile(path.join(backend, 'Example.java'), `@PreAuthorize("hasAuthority('customer.unknown')")`, 'utf8')
    await writeFile(path.join(frontend, 'Example.tsx'), `hasPermission('customer.missing')`, 'utf8')
    const result = await scanPermissionReferences(root, catalogOf(manifest()))
    assert.equal(result.unknown.length, 2)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('reports dangerous ADMIN bypass patterns', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'laundry-permission-bypass-'))
  try {
    const backend = path.join(root, 'backend', 'src', 'main', 'java')
    const frontend = path.join(root, 'frontend', 'src')
    await mkdir(backend, { recursive: true })
    await mkdir(frontend, { recursive: true })
    await writeFile(path.join(backend, 'Example.java'), `@PreAuthorize("hasRole('ADMIN')")`, 'utf8')
    await writeFile(path.join(frontend, 'Example.tsx'), `const allowed = role === 'MANAGER'`, 'utf8')
    const result = await scanPermissionReferences(root, catalogOf(manifest()))
    assert.equal(result.bypassFindings.length, 2)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
