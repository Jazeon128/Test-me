import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import CanvasView from '../canvas/CanvasView'
import { canvasAPI } from '../services/api'
import { layoutDynamic } from './layoutDynamic'

vi.mock('../services/api', () => ({
  canvasAPI: { get: vi.fn(), nodeSource: vi.fn(), save: vi.fn(), update: vi.fn() },
  documentsAPI: {}, notebooksAPI: {}, statusAPI: {},
}))
vi.mock('../canvas/ExcalidrawSurface', () => ({ default: ({ onSave }) => <div>
  Sketch surface<button onClick={() => onSave({ edited: record.edited })}>Save sketch</button>
</div> }))
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
vi.mock('./layoutDynamic', async importOriginal => {
  const module = await importOriginal()
  return { ...module, layoutDynamic: vi.fn(module.layoutDynamic) }
})

const fontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts')

const record = { id: 7, template: 'flowchart', request_text: 'Canvas', payload: {},
  edited: { schema_version: 2, elements: [
    { id: 'rect', type: 'rectangle', x: 0, y: 0, width: 120, height: 70,
      customData: { nodeId: 'a', label: 'Passage label', detail: 'Details', sourceSectionId: 9 } },
    { id: 'ink', type: 'freedraw' },
  ] } }

beforeEach(() => {
  vi.stubEnv('VITE_DYNAMIC_CANVAS', 'true')
  vi.clearAllMocks()
  Object.defineProperty(document, 'fonts', { configurable: true, value: { load: vi.fn().mockResolvedValue([]) } })
  localStorage.clear()
  canvasAPI.get.mockResolvedValue({ data: record })
  canvasAPI.nodeSource.mockResolvedValue({ data: { section: {} } })
  canvasAPI.update.mockResolvedValue({ data: {} })
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  if (fontsDescriptor) Object.defineProperty(document, 'fonts', fontsDescriptor)
  else delete document.fonts
})

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

it('defaults to Sketch without the View control when the flag is unset', async () => {
  vi.stubEnv('VITE_DYNAMIC_CANVAS', undefined)
  render(<CanvasView canvasId="7" />)
  expect(await screen.findByText('Sketch surface')).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'View' })).not.toBeInTheDocument()
  expect(screen.queryByText('Dynamic surface')).not.toBeInTheDocument()
  expect(screen.queryByText(/sketch-only items/)).not.toBeInTheDocument()
  expect(layoutDynamic).not.toHaveBeenCalled()
  expect(document.fonts.load).not.toHaveBeenCalled()
})

it.each(['false', 'TRUE'])('ignores a stored Dynamic preference when the flag is %s', async flag => {
  vi.stubEnv('VITE_DYNAMIC_CANVAS', flag)
  localStorage.setItem('test-me.canvasMode', 'dynamic')
  render(<CanvasView canvasId="7" />)
  expect(await screen.findByText('Sketch surface')).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'View' })).not.toBeInTheDocument()
  expect(screen.queryByText('Dynamic surface')).not.toBeInTheDocument()
  expect(screen.queryByText(/sketch-only items/)).not.toBeInTheDocument()
  expect(localStorage.getItem('test-me.canvasMode')).toBe('dynamic')
  expect(layoutDynamic).not.toHaveBeenCalled()
  expect(document.fonts.load).not.toHaveBeenCalled()
})

it('keeps Sketch saves free of Dynamic layout and font loading when disabled', async () => {
  vi.stubEnv('VITE_DYNAMIC_CANVAS', 'false')
  render(<CanvasView canvasId="7" />)
  await screen.findByText('Sketch surface')
  fireEvent.click(screen.getByRole('button', { name: 'Save sketch' }))
  expect(screen.queryByText('Dynamic surface')).not.toBeInTheDocument()
  expect(layoutDynamic).not.toHaveBeenCalled()
  expect(document.fonts.load).not.toHaveBeenCalled()
})
