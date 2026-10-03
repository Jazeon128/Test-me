import { expect, it } from 'vitest'
import { edgeLabelWidth, EDGE_LABEL_HEIGHT, placeEdgeLabels } from './labels'

function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function plate(edge, point) {
  const w = edgeLabelWidth(edge.label)
  return { x: point.x - w / 2, y: point.y - EDGE_LABEL_HEIGHT / 2, w, h: EDGE_LABEL_HEIGHT }
}

const card = (id, x, y) => ({ id, kind: 'card', x, y, w: 180, h: 62 })

it('places 11 incoming labels between two rows of concepts and a hub without overlaps', () => {
  const nodes = [card('hub', 1124, 336), ...Array.from({ length: 11 }, (_, i) =>
    card(`node-${i}`, i < 2 ? 400 + i * 660 : (i - 2) * 220, i < 2 ? 32 : 184))]
  const labels = ['claimed to develop', 'was not a ranking, unlike', 'critiqued citations of',
    'unsupported numbers in', ...Array(5).fill('supports active spirit of'), 'often travels with', 'borrowed authority from']
  const edges = labels.map((label, i) => ({ id: `edge-${String(i).padStart(2, '0')}`, from: `node-${i}`, to: 'hub', label }))
  const positions = placeEdgeLabels({ nodes, edges })
  expect(positions.size).toBe(11)
  const plates = edges.map(edge => plate(edge, positions.get(edge.id)))
  plates.forEach((a, i) => {
    for (const b of plates.slice(i + 1)) expect(overlaps(a, b), `plate ${i} overlaps another plate`).toBe(false)
    for (const node of nodes) expect(overlaps(a, node), `plate ${i} overlaps ${node.id}`).toBe(false)
  })
  expect(placeEdgeLabels({ nodes, edges: [...edges].reverse() })).toEqual(positions)
})

it('keeps a single edge label at the segment midpoint', () => {
  const nodes = [card('a', 0, 0), card('b', 400, 0)]
  const positions = placeEdgeLabels({ nodes, edges: [{ id: 'edge', from: 'a', to: 'b', label: 'relates to' }] })
  expect(positions.get('edge')).toEqual({ x: 290, y: 31 })
})

it('uses the least-overlapping candidate when every candidate is obstructed', () => {
  const nodes = [card('a', 0, 0), card('b', 400, 0), { ...card('obstacle', 220, -200), w: 200, h: 400 }]
  const positions = placeEdgeLabels({ nodes, edges: [{ id: 'edge', from: 'a', to: 'b', label: 'relates to' }] })
  expect(positions.get('edge')).toEqual({ x: 224, y: 59 })
})
