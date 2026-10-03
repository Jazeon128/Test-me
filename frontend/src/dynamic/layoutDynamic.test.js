import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import fixture from '../../demo/fixture.json'
import { layoutDynamic } from './layoutDynamic'
import { fitNode, innerBox } from './fit'
import { nodeText } from './text'
import { edgeLabelWidth, EDGE_LABEL_HEIGHT, edgeLabelZ, placeEdgeLabels, projectRectangle } from './labels'

const measure = (text, size) => text.length * 0.55 * size
const records = Object.entries(fixture.routes).filter(([route]) => /^GET \/canvas\/\d+$/.test(route))
function overlaps(a, b, tolerance = 0) {
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > tolerance
    && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > tolerance
}

it('checks exactly 4 real demo canvases', () => expect(records).toHaveLength(4))

it.each(records)('fits text and separates nodes and edge plates in %s', async (_, record) => {
  const { doc, skipped } = await layoutDynamic(record, measure)
  expect(skipped).toBe(0)
  doc.nodes.forEach((node, i) => {
    for (const other of doc.nodes.slice(i + 1)) {
      expect(overlaps(node, other, 2), `${node.id} overlaps ${other.id}`).toBe(false)
    }
    const box = innerBox(node)
    expect(node.lines.length * 1.3 * node.textSize, node.id).toBeLessThanOrEqual(box.h + 0.001)
    node.lines.forEach(line => expect(measure(line, node.textSize), node.id).toBeLessThanOrEqual(box.w + 0.001))
    expect(node.lines.join(' ').replace(/\s/g, '')).toBe(nodeText(node).replace(/\s/g, ''))
    if (node.kind !== 'tier' && node.value === node.label) {
      expect(node.lines.join(' ').replace(/\s/g, '')).toBe(node.label.replace(/\s/g, ''))
    }
  })
  const positions = placeEdgeLabels(doc)
  const nodesById = new Map(doc.nodes.map(node => [node.id, node]))
  const plates = doc.edges.filter(edge => edge.label).map(edge => {
    const point = positions.get(edge.id), w = edgeLabelWidth(edge.label)
    return { x: point.x - w / 2, y: point.y - EDGE_LABEL_HEIGHT / 2, w, h: EDGE_LABEL_HEIGHT,
      z: edgeLabelZ(nodesById.get(edge.from), nodesById.get(edge.to), point) }
  })
  plates.forEach((plate, i) => {
    for (const node of doc.nodes) expect(overlaps(plate, node), `plate ${i} overlaps ${node.id}`).toBe(false)
    for (const other of plates.slice(i + 1)) expect(overlaps(plate, other), `plate ${i} overlaps another plate`).toBe(false)
  })
  const tiltedNodes = doc.nodes.map(node => projectRectangle(node, node.z + node.style.extrusion))
  const tiltedPlates = plates.map(plate => projectRectangle(plate, plate.z))
  tiltedPlates.forEach((plate, i) => {
    for (const node of tiltedNodes) expect(overlaps(plate, node), `Tilted plate ${i} overlaps a node`).toBe(false)
    for (const other of tiltedPlates.slice(i + 1)) {
      expect(overlaps(plate, other), `Tilted plate ${i} overlaps another plate`).toBe(false)
    }
  })
})

it('keeps imported geometry and shrinks only text', async () => {
  const record = { template: 'flowchart', edited: { schema_version: 2, elements: [
    { id: 'a', type: 'rectangle', x: 13, y: 27, width: 120, height: 62,
      customData: { label: 'Text that must shrink to fit' } },
  ] } }
  const { doc } = await layoutDynamic(record, measure)
  expect(doc.nodes[0]).toMatchObject({ x: 13, y: 27, w: 120, h: 62, textSize: 12 })
})

it('applies saved positions after fitted layout', async () => {
  const record = { template: 'flowchart', payload: { nodes: [{ id: 'a', label: 'Label' }], edges: [] },
    layout: { a: { x: 123, y: 456 } } }
  const { doc } = await layoutDynamic(record, measure)
  expect(doc.nodes[0]).toMatchObject({ x: 123, y: 456 })
  expect(fitNode(doc.nodes[0], measure).lines).toEqual(doc.nodes[0].lines)
})

it('lets the header scroll away while preserving menu stacking', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const header = css.match(/\.app-header\s*\{([^}]+)\}/)[1]
  expect(header).toContain('position: relative')
  expect(header).not.toContain('sticky')
  expect(header).toContain('z-index: 40')
})
