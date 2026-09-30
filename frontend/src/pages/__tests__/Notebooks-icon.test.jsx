import { describe, expect, it } from 'vitest'
import { displayIcon } from '../../utils/displayIcon'

describe('displayIcon', () => {
  it.each([null, '', '??', 'ab'])('uses the fallback for %j', (icon) => {
    expect(displayIcon(icon)).toBe('\u{1F4D8}')
  })

  it.each(['\u{1F4D8}', '\u{1F4C1}', '\u2699\uFE0F'])('preserves %s', (icon) => {
    expect(displayIcon(icon)).toBe(icon)
  })
})
