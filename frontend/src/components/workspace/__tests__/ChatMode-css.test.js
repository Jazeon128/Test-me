import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('loads segmented control styles globally without the lazy canvas stylesheet', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const dynamic = readFileSync('src/dynamic/dynamic.css', 'utf8')
  for (const rule of [
    '.tm-segmented { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-solid); padding: 3px; gap: 3px; }',
    '.tm-segmented button { padding: 6px 12px; min-height: 36px; border-radius: 5px; font-size: 12px; color: var(--text); }',
    '.tm-segmented button[aria-pressed="true"] { background: var(--accent); color: var(--accent-ink); }',
    '.tm-segmented button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }',
  ]) {
    expect(css).toContain(rule)
    expect(dynamic).not.toContain(rule)
  }
})
