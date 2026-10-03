import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)))

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path)
    return /\.[cm]?[jt]sx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) ? [path] : []
  })
}

it('imports the axios client only in the shared API client', () => {
  const directImports = sourceFiles(sourceRoot)
    .filter(path => relative(sourceRoot, path).replaceAll('\\', '/') !== 'services/api.js')
    // Adapters need AxiosError to reject responses, but must not create clients.
    .filter(path => /\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)['"]axios['"]/.test(
      readFileSync(path, 'utf8').replace(/import\s*\{\s*AxiosError\s*\}\s*from\s*['"]axios['"]/g, '')
    ))
    .map(path => relative(sourceRoot, path))

  expect(directImports).toEqual([])
})
