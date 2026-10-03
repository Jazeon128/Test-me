import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const sourceRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

function jsxFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : jsxFiles(path)
    return entry.name.endsWith('.jsx') && !/\.(test|spec)\./.test(entry.name) ? [path] : []
  })
}

it('pairs every light hover background with a dark hover background in the same class string', () => {
  const violations = []
  const lightHover = /(?:^|\s)hover:bg-(?:[a-z]+-(?:50|100|200)|white)(?:\/\S+)?(?=\s|$)/
  const darkHover = /(?:^|\s)dark:hover:bg-\S+/

  for (const path of jsxFiles(sourceRoot)) {
    const source = readFileSync(path, 'utf8')
    const check = (classes, offset) => {
      if (lightHover.test(classes) && !darkHover.test(classes)) {
        const line = source.slice(0, offset).split('\n').length
        violations.push(`${relative(sourceRoot, path).replaceAll('\\', '/')}:${line}: ${classes.trim()}`)
      }
    }

    // Scan quoted strings independently so a conditional branch cannot borrow
    // another branch's dark variant. This also covers optionClass assignments.
    for (const match of source.matchAll(/(['"])((?:\\.|(?!\1)[^\\])*?)\1/g)) {
      check(match[2], match.index)
    }
    // Check each static part of a template separately from its expressions.
    for (const template of source.matchAll(/`((?:\\.|[^`\\])*?)`/g)) {
      const staticParts = template[1].replace(/\$\{[\s\S]*?\}/g, expression => ' '.repeat(expression.length))
      for (const part of staticParts.matchAll(/[^{}]+/g)) {
        check(part[0], template.index + 1 + part.index)
      }
    }
  }

  expect(violations, `Light hover backgrounds without dark variants:\n${violations.join('\n')}`).toEqual([])
})
