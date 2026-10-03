import { expect, it } from 'vitest'
import { fitNode, innerBox } from './fit'
import { nodeText, wrapLines } from './text'

const measure = (text, size) => text.length * 0.55 * size
const node = { kind: 'card', w: 180, h: 62, label: 'One two three four five six seven eight nine ten eleven twelve' }
const fits = fitted => {
  const box = innerBox(fitted)
  expect(fitted.lines.length * 1.3 * fitted.textSize).toBeLessThanOrEqual(box.h + 0.001)
  fitted.lines.forEach(line => expect(measure(line, fitted.textSize)).toBeLessThanOrEqual(box.w + 0.001))
}

it('wraps spaces, explicit newlines and oversized words', () => {
  expect(wrapLines('abc def\nghijklmnop', { maxWidth: 33, size: 10, weight: 500 }, measure))
    .toEqual(['abc', 'def', 'ghijkl', 'mnop'])
})

it('widens cards and grows ellipses and diamonds to fit', () => {
  const card = fitNode(node, measure)
  expect(card.w).toBe(220)
  fits(card)
  for (const kind of ['ellipse', 'diamond']) {
    const fitted = fitNode({ ...node, kind }, measure)
    expect(fitted.h).toBeGreaterThan(62)
    fits(fitted)
  }
})

it.each([{ kind: 'tier', topWidth: 180 }, { kind: 'card', imported: true }])(
  'keeps fixed sizes and shrinks text with an 11 px floor: %j', extra => {
    const fitted = fitNode({ ...node, ...extra, label: 'Text that needs a smaller font to fit' }, measure)
    expect([fitted.w, fitted.h]).toEqual([180, 62])
    expect(fitted.textSize).toBeLessThan(16)
    fits(fitted)
    const floor = fitNode({ ...node, ...extra, label: 'unfit '.repeat(100) }, measure)
    expect(floor.textSize).toBe(11)
    expect([floor.w, floor.h]).toEqual([180, 62])
  })

it('shows values only for tiers or distinct values, including zero', () => {
  expect(nodeText({ label: 'Same', value: 'Same', kind: 'card' })).toBe('Same')
  expect(nodeText({ label: 'Same', value: 'Same', kind: 'tier' })).toBe('Same\nSame')
  expect(nodeText({ label: 'Label', value: 0, kind: 'card' })).toBe('0\nLabel')
})
