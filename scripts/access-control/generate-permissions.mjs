import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generatedOutputs, loadCatalog } from './lib.mjs'

export async function generate(repoRoot) {
  const catalog = await loadCatalog(repoRoot)
  for (const [file, content] of generatedOutputs(repoRoot, catalog)) {
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, content, 'utf8')
  }
  return catalog
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  generate(repoRoot)
    .then((catalog) => console.log(`Generated ${catalog.permissions.length} permission constants.`))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
