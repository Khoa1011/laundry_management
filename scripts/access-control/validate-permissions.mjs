import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkGenerated } from './check-generated-permissions.mjs'
import { loadCatalog, scanPermissionReferences } from './lib.mjs'

export async function validate(repoRoot, options = {}) {
  const catalog = await loadCatalog(repoRoot)
  const { unknown, bypassFindings } = await scanPermissionReferences(repoRoot, catalog)
  if (unknown.length > 0) throw new Error(unknown.join('\n'))
  if (!options.skipGeneratedCheck) await checkGenerated(repoRoot)
  return { catalog, bypassFindings }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  validate(repoRoot)
    .then(({ catalog, bypassFindings }) => {
      console.log(`Validated ${catalog.manifests.length} modules and ${catalog.permissions.length} permissions.`)
      if (bypassFindings.length === 0) console.log('No dangerous role-name bypass patterns found.')
      else {
        console.warn('Potential role-name bypass findings:')
        for (const finding of bypassFindings) console.warn(`- ${finding}`)
      }
    })
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
