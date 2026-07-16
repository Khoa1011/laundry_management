import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from './lib.mjs'

let input = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) input += chunk

const relevant = /access-control[\\/]|PermissionCodes|permissionCodes\.generated|module-access-control-first/i.test(input)
if (relevant) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  try {
    const catalog = await loadCatalog(repoRoot)
    console.log(`Permission manifest check passed (${catalog.permissions.length} permissions).`)
  } catch (error) {
    console.error(`Permission manifest check failed: ${error.message}`)
    process.exitCode = 1
  }
}
