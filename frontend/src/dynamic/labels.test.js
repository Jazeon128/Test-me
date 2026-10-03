import { expect, it } from 'vitest'
import { edgeLabelWidth, EDGE_LABEL_HEIGHT, edgeLabelZ, placeEdgeLabels, projectRectangle } from './labels'

function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function plate(edge, point) {
  const w = edgeLabelWidth(edge.label)
  return { x: point.x - w / 2, y: point.y - EDGE_LABEL_HEIGHT / 2, w, h: EDGE_LABEL_HEIGHT }
}

const card = (id, x, y) => ({ id, kind: 'card', x, y, w: 180, h: 62, z: 0, style: { extrusion: 16 } })

it('places 11 incoming labels between two rows of concepts and a hub without overlaps', () => {
  const nodes = [{ ...card('hub', 1124, 336), z: 40, style: { extrusion: 28 } }, ...Array.from({ length: 11 }, (_, i) =>
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
  const tiltedNodes = nodes.map(node => projectRectangle(node, node.z + node.style.extrusion))
  const tiltedPlates = edges.map((edge, i) => projectRectangle(plates[i],
    edgeLabelZ(nodes[i + 1], nodes[0], positions.get(edge.id))))
  tiltedPlates.forEach((a, i) => {
    for (const b of tiltedPlates.slice(i + 1)) expect(overlaps(a, b), `Tilted plate ${i} overlaps another plate`).toBe(false)
    for (const node of tiltedNodes) expect(overlaps(a, node), `Tilted plate ${i} overlaps a node`).toBe(false)
  })
  expect(placeEdgeLabels({ nodes, edges: [...edges].reverse() })).toEqual(positions)
})

it('keeps a single edge label at the segment midpoint', () => {
  const nodes = [card('a', 0, 0), card('b', 400, 0)]
  const positions = placeEdgeLabels({ nodes, edges: [{ id: 'edge', from: 'a', to: 'b', label: 'relates to' }] })
  expect(positions.get('edge')).toEqual({ x: 290, y: 31 })
})

it('uses the least-overlapping candidate when every candidate is obstructed', () => {
  const nodes = [card('a', 0, 0), card('b', 400, 0), { ...card('obstacle', 220, -500), w: 200, h: 1000 }]
  const positions = placeEdgeLabels({ nodes, edges: [{ id: 'edge', from: 'a', to: 'b', label: 'relates to' }] })
  expect(positions.get('edge')).toEqual({ x: 191, y: 199 })
  expect(overlaps(plate({ label: 'relates to' }, positions.get('edge')), nodes[2])).toBe(true)
})

it('projects all rectangle corners with graph y increasing downwards', () => {
  const projected = projectRectangle({ x: 10, y: 20, w: 30, h: 40 }, 68)
  const angle = 55 * Math.PI / 180
  expect(projected.x).toBe(10)
  expect(projected.w).toBe(30)
  expect(projected.y).toBeCloseTo(20 * Math.sin(angle) - 68 * Math.cos(angle))
  expect(projected.h).toBeCloseTo(40 * Math.sin(angle))
})

it('prefers the source end only for targets with at least 3 incoming labelled edges', () => {
  const nodes = [card('a', 0, 0), card('b', 800, 0), card('c', 0, 500), card('d', 0, -500)]
  const edges = [{ id: 'a', from: 'a', to: 'b', label: 'relates to' },
    { id: 'b', from: 'c', to: 'b', label: 'relates to' },
    { id: 'c', from: 'd', to: 'b', label: 'relates to' }]
  expect(placeEdgeLabels({ nodes, edges }).get('a')).toEqual({ x: 335, y: 31 })
  expect(placeEdgeLabels({ nodes, edges: edges.slice(0, 2) }).get('a')).toEqual({ x: 490, y: 31 })
  expect(placeEdgeLabels({ nodes, edges: [...edges.slice(0, 2), { ...edges[2], label: '' }] }).get('a'))
    .toEqual({ x: 490, y: 31 })
})

it('interpolates plate height along the edge and clamps points beyond its ends', () => {
  const source = card('a', 0, 0), target = { ...card('b', 800, 0), z: 40, style: { extrusion: 28 } }
  expect(edgeLabelZ(source, target, { x: 335, y: 31 })).toBe(30)
  expect(edgeLabelZ(source, target, { x: 490, y: 90 })).toBe(43)
  expect(edgeLabelZ(source, target, { x: 0, y: 31 })).toBe(17)
  expect(edgeLabelZ(source, target, { x: 1000, y: 31 })).toBe(69)
})

it('rejects a graph-clear midpoint obstructed by a raised node in Tilted', () => {
  const nodes = [card('a', 0, 0), card('b', 400, 0),
    { ...card('raised', 245, 100), w: 90, h: 40, z: 124 }]
  const edge = { id: 'edge', from: 'a', to: 'b', label: 'relates to' }
  const position = placeEdgeLabels({ nodes, edges: [edge] }).get(edge.id)
  expect(position).not.toEqual({ x: 290, y: 31 })
  const candidate = plate(edge, position)
  expect(overlaps(candidate, nodes[2])).toBe(false)
  expect(overlaps(projectRectangle(candidate, edgeLabelZ(nodes[0], nodes[1], position)),
    projectRectangle(nodes[2], 140))).toBe(false)
})
