import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import NotebookWorkspace from '../NotebookWorkspace'
import Canvas from '../Canvas'
import { canvasAPI, documentsAPI, notebooksAPI, statusAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  canvasAPI: { get: vi.fn(), generate: vi.fn(), update: vi.fn() },
  documentsAPI: { get: vi.fn() },
  notebooksAPI: { workspace: vi.fn(), get: vi.fn(), chatHistory: vi.fn() },
  statusAPI: { get: vi.fn() },
}))
vi.mock('../../canvas/layout', () => ({ toGraph: () => ({ nodes: [], edges: [] }), layout: async (_, graph) => graph }))
vi.mock('@excalidraw/excalidraw', () => {
  const MainMenu = () => null
  MainMenu.DefaultItems = { Export: () => null, Help: () => null }
  return {
    Excalidraw: ({ initialData, onChange }) => <div className="excalidraw"><button onClick={() => onChange(
      initialData.elements.map(element => ({ ...element, x: 99, version: element.version + 1 })),
      { selectedElementIds: {} },
    )}>Move node</button></div>, MainMenu,
    convertToExcalidrawElements: skeletons => skeletons.map(element => ({ ...element, version: 1 })),
  }
})
const record = (id = 1, notebook_id = 2) => ({ id, notebook_id, title: 'Cell diagram', request_text: 'Explain cells',
  template: 'flowchart', source_ids: [3], sources: [{ id: 3, name: 'Cells.pdf' }], payload: {},
  edited: { schema_version: 1, nodes: [{ id: 'a', type: 'StepNode', data: { label: 'Cell' }, position: { x: 0, y: 0 } }], edges: [] } })
function Probe() {
  const location = useLocation()
  const navigate = useNavigate()
  return <><output aria-label="URL">{location.pathname}{location.search}</output><button onClick={() => navigate(-1)}>Previous</button></>
}
function mount(url = '/notebooks/2', previous = '/') {
  return render(<MemoryRouter initialEntries={[previous, url]} initialIndex={1}><Probe /><Routes>
    <Route path="/notebooks/:notebookId" element={<NotebookWorkspace />} />
    <Route path="/canvas" element={<Canvas />} /><Route path="/canvas/:canvasId" element={<Canvas />} />
    <Route path="/" element={<p>Notebook list</p>} />
  </Routes></MemoryRouter>)
}
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  notebooksAPI.workspace.mockResolvedValue({ data: { notebook: { id: 2, name: 'Biology' },
    sources: [3, 4].map(id => ({ id, display_name: `Source ${id}`, status: 'ready' })),
    artifacts: { decks: [], canvases: [{ id: 1, title: 'Cell diagram' }, { id: 5, title: 'Legacy diagram' }] }, jobs: [], progress: {} } })
  notebooksAPI.chatHistory.mockResolvedValue({ data: [] })
  notebooksAPI.get.mockResolvedValue({ data: { id: 2, name: 'Biology' } })
  documentsAPI.get.mockImplementation(id => Promise.resolve({ data: { id: Number(id), notebook_id: 2, notebook_name: 'Biology', display_name: `Source ${id}` } }))
  canvasAPI.get.mockImplementation(id => Promise.resolve({ data: record(Number(id)) }))
  canvasAPI.generate.mockResolvedValue({ data: { job_id: 'mock-job' } })
  canvasAPI.update.mockResolvedValue({ data: {} })
  statusAPI.get.mockResolvedValue({ data: { status: 'completed', result_id: 1 } })
})
it('opens a saved canvas in the centre with title, focus and no back button', async () => {
  mount('/notebooks/2?view=canvas&canvas=1')
  const header = await screen.findByRole('heading', { name: 'Canvas: Cell diagram' })
  const centre = screen.getByRole('region', { name: 'Canvas' })
  expect(await within(centre).findByRole('button', { name: 'Move node' })).toBeInTheDocument()
  expect(header.parentElement).toHaveFocus()
  expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Sources')).toHaveClass('workspace-rail')
  expect(screen.getByLabelText('Studio')).toHaveClass('workspace-rail')
})
it.each([['', [3]], ['&sources=4', [4]]])('uses ticked sources or the explicit override %s', async (query, ids) => {
  if (query) mount(`/notebooks/2?view=canvas${query}`)
  else {
    mount()
    await screen.findByText('Biology')
    fireEvent.click(screen.getByLabelText('Source 4'))
    click('Canvas')
  }
  await screen.findByRole('heading', { name: 'New canvas' })
  const input = await screen.findByLabelText('What do you want to see?')
  fireEvent.change(input, { target: { value: 'Draw cells' } })
  click('Draw it')
  await waitFor(() => expect(canvasAPI.generate).toHaveBeenCalledWith({ sourceIds: ids, requestText: 'Draw cells', template: null }))
  await waitFor(() => expect(screen.getByLabelText('URL')).toHaveTextContent('/notebooks/2?view=canvas&canvas=1'))
  expect(screen.getByLabelText('URL')).not.toHaveTextContent('sources=')
  click('Previous')
  if (query) expect(await screen.findByText('Notebook list')).toBeInTheDocument()
  else await screen.findByText('Biology')
})
it('flushes before close, clears canvas params, restores focus and saved rails', async () => {
  localStorage.setItem('testme.workspace.collapsed', JSON.stringify({ sources: true, studio: false }))
  mount()
  await screen.findByText('Biology')
  const link = screen.getByRole('link', { name: 'Open Cell diagram' })
  expect(link).toHaveAttribute('href', '/notebooks/2?view=canvas&canvas=1')
  fireEvent.click(link)
  await screen.findByRole('button', { name: 'Move node' })
  click('Expand sources'); click('Expand studio')
  expect(screen.getByLabelText('Sources')).not.toHaveClass('workspace-rail')
  expect(screen.getByLabelText('Studio')).not.toHaveClass('workspace-rail')
  expect(JSON.parse(localStorage.getItem('testme.workspace.collapsed'))).toEqual({ sources: true, studio: false })
  let finish
  canvasAPI.update.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  click('Move node'); click('Close')
  await waitFor(() => expect(canvasAPI.update).toHaveBeenCalled())
  expect(screen.getByLabelText('URL')).toHaveTextContent('view=canvas&canvas=1')
  await act(async () => finish({ data: {} }))
  await waitFor(() => expect(screen.getByLabelText('URL').textContent).toBe('/notebooks/2'))
  expect(screen.getByLabelText('Sources')).toHaveClass('workspace-rail')
  expect(screen.getByLabelText('Studio')).not.toHaveClass('workspace-rail')
  expect(screen.getByRole('link', { name: 'Open Cell diagram' })).toHaveFocus()
  expect(JSON.parse(localStorage.getItem('testme.workspace.collapsed'))).toEqual({ sources: true, studio: false })
})
it('opens the Studio tile without leaving the notebook and restores tile focus', async () => {
  mount(); await screen.findByText('Biology'); click('Canvas')
  expect(screen.getByLabelText('URL').textContent).toBe('/notebooks/2?view=canvas')
  await screen.findByLabelText('What do you want to see?')
  click('Close')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Canvas' })).toHaveFocus())
})
it.each([
  ['/canvas/5', '/notebooks/2?view=canvas&canvas=5'],
  ['/canvas?sources=3&notebook=2', '/notebooks/2?view=canvas&sources=3'],
  ['/canvas?sources=3', '/notebooks/2?view=canvas&sources=3'],
])('replaces compatibility route %s', async (url, target) => {
  mount(url)
  await waitFor(() => expect(screen.getByLabelText('URL').textContent).toBe(target))
  click('Previous')
  expect(await screen.findByText('Notebook list')).toBeInTheDocument()
})
it('keeps a canvas with no notebook standalone', async () => {
  canvasAPI.get.mockResolvedValue({ data: record(5, null) })
  mount('/canvas/5')
  expect(await screen.findByRole('button', { name: 'Back to notebooks' })).toBeInTheDocument()
  expect(screen.getByLabelText('URL').textContent).toBe('/canvas/5')
  click('Back to notebooks')
  expect(await screen.findByText('Notebook list')).toBeInTheDocument()
})
it('keeps sources from different notebooks standalone', async () => {
  documentsAPI.get.mockImplementation(id => Promise.resolve({ data: { id: Number(id), notebook_id: Number(id), display_name: `Source ${id}` } }))
  mount('/canvas?sources=3,4')
  await screen.findByText('Source 4')
  expect(screen.getByRole('button', { name: 'Back to notebooks' })).toBeInTheDocument()
  expect(screen.getByLabelText('URL').textContent).toBe('/canvas?sources=3,4')
})

it('clears view, canvas and sources while preserving unrelated params', async () => {
  mount('/notebooks/2?view=canvas&canvas=1&sources=3&keep=1')
  await screen.findByRole('button', { name: 'Move node' })
  click('Close')
  await waitFor(() => expect(screen.getByLabelText('URL').textContent).toBe('/notebooks/2?keep=1'))
})
it('does not close when the pending save fails', async () => {
  mount('/notebooks/2?view=canvas&canvas=1')
  await screen.findByRole('button', { name: 'Move node' })
  canvasAPI.update.mockRejectedValueOnce(new Error('Offline'))
  click('Move node'); click('Close')
  await screen.findByText('Save failed')
  expect(screen.getByLabelText('URL').textContent).toBe('/notebooks/2?view=canvas&canvas=1')
})

it('hides only the embedded inner title and retains the canvas header controls', async () => {
  mount('/notebooks/2?view=canvas&canvas=1')
  await screen.findByRole('button', { name: 'Move node' })
  expect(screen.getByRole('heading', { name: 'Canvas: Cell diagram' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Explain cells' })).not.toBeInTheDocument()
  expect(screen.getByText('Cells.pdf')).toBeInTheDocument()
  expect(screen.getByText('Saved')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Restore original' })).toBeInTheDocument()
  expect(screen.getByText('Drawn as: flowchart')).toBeInTheDocument()
  expect(screen.getByLabelText('What do you want to see?')).toBeInTheDocument()
})
it('keeps the standalone inner title', async () => {
  canvasAPI.get.mockResolvedValue({ data: record(5, null) })
  mount('/canvas/5')
  expect(await screen.findByRole('heading', { name: 'Cell diagram' })).toBeInTheDocument()
})
it('scopes notebook target sizing outside the embedded whiteboard surface', async () => {
  const { container } = mount('/notebooks/2?view=canvas&canvas=1')
  const nodeButton = await screen.findByRole('button', { name: 'Move node' })
  expect(container.querySelector('.tm-canvas')).toHaveClass('tm-canvas-embedded')
  const css = readFileSync('src/index.css', 'utf8')
  const rule = css.match(/([^{}]+)\{ min-height: 44px; min-width: 44px; \}/)
  expect(rule).not.toBeNull()
  const selector = rule[1].trim()
  expect(nodeButton.closest('.tm-whiteboard .excalidraw')).not.toBeNull()
  const canvasCss = readFileSync('src/canvas/canvas.css', 'utf8')
  expect(canvasCss).toContain('.notebook-workspace .tm-canvas.tm-canvas-embedded .tm-whiteboard .excalidraw :is(button, input, select, [role="button"])')
  expect(canvasCss).toContain('min-height: 0;')
  expect(screen.getByRole('button', { name: 'Restore original' }).matches(selector)).toBe(true)
  expect(screen.getByRole('button', { name: 'Close', exact: true }).matches(selector)).toBe(true)
  expect(css).toContain('.tm-edit-toolbar button { width: 36px; height: 36px;')
})

it('formats request titles in the centre header and Studio canvases list', async () => {
  const raw = 'draw me a table of the cheat sheet?'
  notebooksAPI.workspace.mockResolvedValue({ data: { notebook: { id: 2, name: 'Biology' },
    sources: [], artifacts: { decks: [], canvases: [{ id: 1, title: raw }] }, jobs: [], progress: {} } })
  canvasAPI.get.mockResolvedValue({ data: { ...record(), title: raw } })
  mount()
  const link = await screen.findByRole('link', { name: 'Open A table of the cheat sheet' })
  fireEvent.click(link)
  expect(await screen.findByRole('heading', { name: 'Canvas: A table of the cheat sheet' })).toBeInTheDocument()
})
