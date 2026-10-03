import { expect, it, vi } from 'vitest'
import { pyramidGraph } from '../layout'
import { graphSkeletons, graphToScene } from '../scene'

vi.mock('@excalidraw/excalidraw', () => ({
  convertToExcalidrawElements: elements => elements.map(element => element.type === 'text'
    ? { ...element, width: Math.max(...element.text.split('\n').map(line => line.length * element.fontSize)),
      height: element.text.split('\n').length * element.fontSize * 1.25 }
    : element),
}))

it('lets Excalidraw measure text and centres the measured box', () => {
  const graph = pyramidGraph({ nodes: [{ id: 'band', label: 'NTL Institute credited with chart' }] })
  const skeleton = graphSkeletons('pyramid', graph).find(element => element.type === 'text')
  expect(skeleton).not.toHaveProperty('width')
  expect(skeleton).not.toHaveProperty('height')
  const text = graphToScene('pyramid', graph).find(element => element.type === 'text')
  expect(text.width).toBeLessThanOrEqual(240 * 0.85)
  expect(text.x + text.width / 2).toBe(0)
  expect(text.y + text.height / 2).toBe(36)
  expect(text.text.replace(/\n/g, ' ')).toBe('NTL Institute credited with chart')
})
