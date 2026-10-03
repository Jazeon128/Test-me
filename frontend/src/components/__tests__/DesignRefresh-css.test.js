import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
const css = readFileSync('src/index.css', 'utf8')
const luminance = hex => {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
}
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05)
it.each([':root', '.dark'])('keeps %s token text contrast at 4.5:1', selector => {
  const block = css.slice(css.indexOf(`${selector} {`)).match(/^[^{]+\{([^}]+)\}/)[1]
  const tokens = Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[\da-f]{6});/g)].map(match => [match[1], match[2]]))
  for (const text of ['--ink', '--muted', '--accent']) {
    for (const background of ['--shell', '--surface-solid']) expect(contrast(tokens[text], tokens[background]), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5)
  }
  expect(contrast(tokens['--accent-ink'], tokens['--accent'])).toBeGreaterThanOrEqual(4.5)
})
it.each(['@media (prefers-reduced-transparency: reduce)', '@media (prefers-contrast: more)', '@supports not (backdrop-filter: blur(1px))', '@media (forced-colors: active)'])('%s disables every floating glass selector', rule => {
  const glass = css.match(/@supports \(backdrop-filter: blur\(1px\)\)\s*\{\s*([^{}]+)\{/)[1].trim()
  const fallback = css.slice(css.indexOf(rule)).match(/^[^{]+\{\s*([^{}]+)\{([^}]+)\}/)
  expect(fallback[1].trim()).toBe(glass)
  expect(fallback[2]).toContain('background: var(--surface-solid) !important')
  expect(fallback[2]).toContain('backdrop-filter: none !important')
})
