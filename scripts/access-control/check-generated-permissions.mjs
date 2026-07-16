import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generatedOutputs, loadCatalog } from './lib.mjs'

export async function checkGenerated(repoRoot) {
  const catalog = await loadCatalog(repoRoot)
  const drift = []
  for (const [file, expected] of generatedOutputs(repoRoot, catalog)) {
    let actual
    try {
      actual = await readFile(file, 'utf8')
    } catch {
      drift.push(`${path.relative(repoRoot, file)} is missing`)
      continue
    }
    if (actual !== expected) drift.push(`${path.relative(repoRoot, file)} is out of sync`)
  }
  if (drift.length > 0) throw new Error(drift.join('\n'))
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  checkGenerated(repoRoot)
    .then(() => console.log('Generated permission files are synchronized.'))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
