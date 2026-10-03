import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import CanvasView from '../CanvasView'
import { canvasAPI } from '../../services/api'

const state = vi.hoisted(() => ({ elkInput: null, graph: null }))
vi.mock('elkjs/lib/elk.bundled.js', async importOriginal => {
  const { default: ELK } = await importOriginal()
  return { default: class extends ELK {
    constructor() {
      super()
      const realLayout = this.layout.bind(this)
      this.layout = graph => {
        state.elkInput = graph
        return realLayout(graph)
      }
    }
  } }
})
vi.mock('../../services/api', () => ({
  canvasAPI: { get: vi.fn(), update: vi.fn() },
  documentsAPI: {}, notebooksAPI: {}, statusAPI: {},
}))
vi.mock('../scene', () => ({ graphToScene: (_template, graph) => {
  state.graph = graph
  return []
} }))
vi.mock('../ExcalidrawSurface', () => ({ default: () => <div data-testid="layout-board" /> }))

const payload = {
  nodes: [{ id: 'hub', label: 'Hub' }, ...Array.from({ length: 11 }, (_, i) => ({
    id: `node-${i}`, label: `Concept ${i}`,
  }))],
  edges: [...Array.from({ length: 11 }, (_, i) => ({
    source: `node-${i}`, target: 'hub', label: `Relationship ${i}`,
  })),
  { source: 'node-0', target: 'node-1', label: 'Supports' },
  { source: 'node-2', target: 'node-3', label: 'Depends on' }],
}

beforeEach(() => {
  state.elkInput = null
  state.graph = null
  vi.clearAllMocks()
})

async function openBoard(template, orientation, edited) {
  canvasAPI.get.mockResolvedValue({ data: { id: 7, template, payload: { ...payload, orientation }, edited } })
  render(<CanvasView canvasId="7" />)
  await screen.findByTestId('layout-board')
}

it.each(['concept_map', 'causal_loop'].flatMap(template =>
  ['horizontal', 'vertical'].map(orientation => [template, orientation])
))('draws %s with %s payload orientation as a wide downward layered graph through real elk', async (template, orientation) => {
  await openBoard(template, orientation)
  expect(state.elkInput.layoutOptions).toMatchObject({
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.spacing.nodeNode': '40',
    'elk.layered.spacing.nodeNodeBetweenLayers': '90',
  })
  const nodes = state.graph.nodes
  expect(nodes).toHaveLength(12)
  expect(state.graph.edges).toHaveLength(13)
  const width = Math.max(...nodes.map(n => n.position.x + 180)) - Math.min(...nodes.map(n => n.position.x))
  const height = Math.max(...nodes.map(n => n.position.y + 62)) - Math.min(...nodes.map(n => n.position.y))
  expect(height).toBeLessThan(width)
  const hub = nodes.find(n => n.id === 'hub')
  for (const node of nodes.filter(n => n.id !== 'hub')) {
    expect(hub.position.y - (node.position.y + 62)).toBeGreaterThanOrEqual(90)
  }
  nodes.forEach((a, index) => {
    for (const b of nodes.slice(index + 1)) {
      const overlaps = a.position.x < b.position.x + 180 && b.position.x < a.position.x + 180
        && a.position.y < b.position.y + 62 && b.position.y < a.position.y + 62
      expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false)
    }
  })
})

it.each([['horizontal', 'RIGHT'], ['vertical', 'DOWN']])('keeps flowchart options for %s orientation', async (orientation, direction) => {
  await openBoard('flowchart', orientation)
  expect(state.elkInput.layoutOptions).toEqual({
    'elk.algorithm': 'layered',
    'elk.direction': direction,
    'elk.spacing.nodeNode': '40',
    'elk.layered.spacing.nodeNodeBetweenLayers': '70',
    'elk.padding': '[top=32,left=24,bottom=24,right=24]',
  })
})

it('opens a saved concept map scene without running elk', async () => {
  await openBoard('concept_map', 'horizontal', { schema_version: 2, elements: [] })
  expect(state.elkInput).toBeNull()
  expect(state.graph).toBeNull()
})
