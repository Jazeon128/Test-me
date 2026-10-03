import { expect, it, vi } from 'vitest'
import fixture from '../../../demo/fixture.json'
import { layout, toGraph, wrapEdgeLabel } from '../layout'
import { applySavedPositions } from '../savedPositions'
import { graphSkeletons } from '../scene'

vi.mock('@excalidraw/excalidraw', () => ({ convertToExcalidrawElements: skeletons => skeletons }))

const algorithms = {
  mindmap: 'mrtree', hierarchy: 'mrtree', concept_map: 'layeredDown', causal_loop: 'layeredDown',
}
const records = Object.entries(fixture.routes).filter(([route, record]) =>
  /^GET \/canvas\/\d+$/.test(route)
  && !['pyramid', 'fishbone', 'sequence', 'comparison_matrix'].includes(record.template))

function overlaps(a, b) {
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 2
    && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 2
}

it('includes the reported canvas 6 in the fixture checks', () => {
  expect(records.some(([route]) => route === 'GET /canvas/6')).toBe(true)
})

it.each(records)('%s reserves separate label rectangles and draws arrows through their centres', async (route, record) => {
  const graph = await layout(record.template, toGraph(record.template, record.payload), {
    algorithm: algorithms[record.template] || 'layered', orientation: record.payload.orientation || 'horizontal',
  })
  const skeletons = graphSkeletons(record.template, graph)
  const nodes = skeletons.filter(shape => shape.type !== 'arrow')
  if (route === 'GET /canvas/6') {
    const hub = nodes.find(node => node.label.text === 'The Learning Pyramid')
    expect(hub).toBeDefined()
    const sources = graph.edges.filter(edge => edge.target === hub.id).map(edge =>
      nodes.find(node => node.id === edge.source))
    // The fixture has 10 incoming edges and 1 outgoing edge at this hub.
    expect(sources).toHaveLength(10)
    const meanX = sources.reduce((sum, node) => sum + node.x + node.width / 2, 0) / sources.length
    const boardWidth = Math.max(...nodes.map(node => node.x + node.width)) - Math.min(...nodes.map(node => node.x))
    expect(Math.abs(hub.x + hub.width / 2 - meanX)).toBeLessThanOrEqual(boardWidth * 0.25)
  }
  const rectangles = []
  for (const edge of graph.edges.filter(edge => edge.label?.trim())) {
    expect(edge.labelPosition, `${route} ${edge.id}`).toBeDefined()
    const size = wrapEdgeLabel(edge.label)
    expect(edge.labelText).toBe(size.text)
    const rectangle = { x: edge.labelPosition.x - size.width / 2,
      y: edge.labelPosition.y - size.height / 2, width: size.width, height: size.height }
    for (const other of rectangles) expect(overlaps(rectangle, other), `${route} labels overlap`).toBe(false)
    for (const node of nodes) expect(overlaps(rectangle, node), `${route} ${edge.id} overlaps ${node.id}`).toBe(false)
    rectangles.push(rectangle)
    const arrow = skeletons.find(shape => shape.id === edge.id)
    expect(arrow.points).toHaveLength(3)
    expect(arrow.x + arrow.points[1][0]).toBeCloseTo(edge.labelPosition.x, 8)
    expect(arrow.y + arrow.points[1][1]).toBeCloseTo(edge.labelPosition.y, 8)
    expect(arrow.label).toMatchObject({ text: edge.labelText, fontSize: 16 })
  }
})

it('shifts labels by the average endpoint move without mutating the graph', () => {
  const graph = { nodes: [
    { id: 'a', position: { x: 0, y: 0 } }, { id: 'b', position: { x: 100, y: 100 } },
  ], edges: [{ id: 'ab', source: 'a', target: 'b', labelPosition: { x: 50, y: 50 },
    labelAnchor: { source: { x: 0, y: 0 }, target: { x: 100, y: 100 } } }] }
  expect(applySavedPositions(graph).edges[0].labelPosition).toEqual({ x: 50, y: 50 })
  expect(applySavedPositions(graph, { a: { x: 40, y: 0 } }).edges[0].labelPosition).toEqual({ x: 70, y: 50 })
  expect(applySavedPositions(graph, { a: { x: 40, y: 20 }, b: { x: 120, y: 140 } }).edges[0].labelPosition)
    .toEqual({ x: 80, y: 80 })
  expect(graph.edges[0].labelPosition).toEqual({ x: 50, y: 50 })
})

it('wraps at word boundaries and uses the supplied font measurement', () => {
  const measure = vi.fn((text, fontSize) => ({ width: text.length * fontSize }))
  expect(wrapEdgeLabel('one two three four', measure)).toEqual({ text: 'one two\nthree four', width: 176, height: 48 })
  expect(measure.mock.calls.every(([, fontSize]) => fontSize === 16)).toBe(true)
})
