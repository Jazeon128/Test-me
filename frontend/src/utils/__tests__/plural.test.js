import { expect, it } from 'vitest'
import { plural } from '../plural'

it.each([[0, '0 sources'], [1, '1 source'], [2, '2 sources']])('formats %s sources', (n, expected) => {
  expect(plural(n, 'source')).toBe(expected)
})
it('supports an irregular plural', () => {
  expect(plural(2, 'canvas', 'canvases')).toBe('2 canvases')
  expect(plural(1, 'canvas', 'canvases')).toBe('1 canvas')
})
