import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import CanvasView from '../canvas/CanvasView'
import { canvasAPI } from '../services/api'

vi.mock('../services/api', () => ({
  canvasAPI: { get: vi.fn(), nodeSource: vi.fn(), save: vi.fn() },
  documentsAPI: {}, notebooksAPI: {}, statusAPI: {},
}))
vi.mock('../canvas/ExcalidrawSurface', () => ({ default: () => <div>Sketch surface</div> }))
vi.mock('./DynamicSurface', () => ({ default: ({ doc, onSelectNode }) => <div>
  Dynamic surface<button onClick={() => onSelectNode(doc.nodes[0].id, doc.nodes[0])}>Select passage</button>
  <button onClick={() => onSelectNode(null)}>Clear passage</button>
</div> }))
vi.mock('../canvas/NodePanel', () => ({ default: ({ node }) => <div>Passage: {node.data.label}</div> }))
vi.mock('../canvas/layout', () => ({
  toGraph: () => ({ nodes: [{ id: 'a', position: { x: 20, y: 30 }, data: { label: 'Graph label' } }], edges: [] }),
  layout: async (_, graph) => graph,
}))
vi.mock('../canvas/scene', () => ({ graphToScene: () => [] }))

const record = { id: 7, template: 'flowchart', request_text: 'Canvas', payload: {},
  edited: { schema_version: 2, elements: [
    { id: 'rect', type: 'rectangle', x: 0, y: 0, width: 120, height: 70,
      customData: { nodeId: 'a', label: 'Passage label', detail: 'Details', sourceSectionId: 9 } },
    { id: 'ink', type: 'freedraw' },
  ] } }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  canvasAPI.get.mockResolvedValue({ data: record })
  canvasAPI.nodeSource.mockResolvedValue({ data: { section: {} } })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('switches surfaces, remembers the choice, and opens and clears the passage', async () => {
  const first = render(<CanvasView canvasId="7" />)
  expect(await screen.findByText('Sketch surface')).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'View' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Dynamic' }))
  expect(await screen.findByText('Dynamic surface')).toBeInTheDocument()
  expect(screen.queryByText('Sketch surface')).not.toBeInTheDocument()
  expect(localStorage.getItem('test-me.canvasMode')).toBe('dynamic')
  expect(screen.getByText('1 sketch-only items are not shown in Dynamic view.')).toBeInTheDocument()
  fireEvent.click(screen.getByText('Select passage'))
  expect(await screen.findByText('Passage: Passage label')).toBeInTheDocument()
  expect(canvasAPI.nodeSource).toHaveBeenCalledWith(7, 'a')
  fireEvent.click(screen.getByText('Clear passage'))
  expect(screen.queryByText('Passage: Passage label')).not.toBeInTheDocument()
  first.unmount()
  render(<CanvasView canvasId="7" />)
  expect(await screen.findByText('Dynamic surface')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Sketch' }))
  expect(await screen.findByText('Sketch surface')).toBeInTheDocument()
  expect(localStorage.getItem('test-me.canvasMode')).toBe('sketch')
  expect(canvasAPI.save).not.toHaveBeenCalled()
})

it('survives throwing localStorage reads and writes', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied') })
  render(<CanvasView canvasId="7" />)
  expect(await screen.findByText('Sketch surface')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Dynamic' }))
  expect(await screen.findByText('Dynamic surface')).toBeInTheDocument()
})

it('uses the laid out graph for unsaved boards', async () => {
  canvasAPI.get.mockResolvedValue({ data: { ...record, edited: null } })
  localStorage.setItem('test-me.canvasMode', 'dynamic')
  render(<CanvasView canvasId="7" />)
  await screen.findByText('Dynamic surface')
  fireEvent.click(screen.getByText('Select passage'))
  expect(await screen.findByText('Passage: Graph label')).toBeInTheDocument()
  expect(screen.queryByText(/sketch-only items/)).not.toBeInTheDocument()
})
