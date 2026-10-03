import { expect, it } from 'vitest'
import { canvasTitle } from '../canvasTitle'

it.each([
  ['draw me a table of the cheat sheet?', 'A table of the cheat sheet'],
  ['Please show me how X works!', 'How X works'],
  ['Compare A and B', 'Compare A and B'],
  ['   ', 'Untitled canvas'], ['?', 'Untitled canvas'],
])('formats %j as %j', (raw, title) => expect(canvasTitle(raw)).toBe(title))
