import { act, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import CanvasView from '../CanvasView'
import ExcalidrawSurface from '../ExcalidrawSurface'
import CanvasSaveControls from '../CanvasSaveControls'
import useCanvasPersistence from '../useCanvasPersistence'
import { canvasAPI } from '../../services/api'

const state = vi.hoisted(() => ({ props: null }))
vi.mock('@excalidraw/excalidraw', () => {
  const MainMenu = ({ children }) => <>{children}</>
  MainMenu.DefaultItems = { Export: () => <span>Export</span>, Help: () => <span>Help</span> }
  return { Excalidraw: props => { state.props = props; return <div data-testid="whiteboard">{props.children}</div> },
    MainMenu, convertToExcalidrawElements: elements => elements.map(element => ({ ...element, version: 1 })) }
})
vi.mock('../../services/api', () => ({
  canvasAPI: { get: vi.fn(), update: vi.fn(), nodeSource: vi.fn() },
  documentsAPI: {}, notebooksAPI: {}, statusAPI: {},
}))
vi.mock('../NodePanel', () => ({ default: ({ node, onClose }) => <aside aria-label="Node source">
  {node.data.label}<button onClick={onClose}>Close source</button>
</aside> }))

const elements = [
  { id: 'shape', type: 'rectangle', version: 1, customData: { nodeId: 'a', label: 'Original', sourceSectionId: 's' } },
  { id: 'text', type: 'text', version: 1, containerId: 'shape', text: 'Original' },
  { id: 'user', type: 'ellipse', version: 1 },
  { id: 'header', type: 'rectangle', version: 1, customData: { nodeId: 'h', header: true } },
]
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VITE_DEMO', 'false')
  canvasAPI.get.mockResolvedValue({ data: { id: 7, template: 'flowchart', edited: { schema_version: 2, elements } } })
  canvasAPI.update.mockResolvedValue({ data: {} })
  canvasAPI.nodeSource.mockResolvedValue({ data: { section: null } })
})
afterEach(() => { vi.unstubAllEnvs(); document.documentElement.classList.remove('dark') })
async function open() {
  const view = render(<MemoryRouter><CanvasView canvasId="7" /></MemoryRouter>)
  await screen.findByTestId('whiteboard')
  return view
}
const select = async ids => act(async () => state.props.onChange(elements, {
  selectedElementIds: Object.fromEntries(ids.map(id => [id, true])),
}))

it('opens generated shapes and bound text, closes on user, empty, header and multiple selections', async () => {
  await open()
  await select(['shape'])
  expect(await screen.findByLabelText('Node source')).toHaveTextContent('Original')
  expect(canvasAPI.nodeSource).toHaveBeenCalledWith(7, 'a')
  await select(['text'])
  expect(await screen.findByLabelText('Node source')).toBeInTheDocument()
  for (const ids of [['user'], [], ['header'], ['shape', 'user']]) {
    await select(['shape'])
    await select(ids)
    expect(screen.queryByLabelText('Node source')).not.toBeInTheDocument()
  }
  expect(canvasAPI.update).not.toHaveBeenCalled()
  await select([])
  expect(screen.getByText('Click a shape drawn from your source to see its passage and questions.')).toBeInTheDocument()
})

it('ignores selection and scroll changes, saves version 2 with synced labels and no files', () => {
  const onSave = vi.fn()
  render(<ExcalidrawSurface elements={elements} onSelectNode={vi.fn()} onSelectionChange={vi.fn()} onSave={onSave} />)
  act(() => state.props.onChange(elements, { selectedElementIds: { shape: true }, scrollX: 100 }, { file: {} }))
  expect(onSave).not.toHaveBeenCalled()
  const next = elements.map(element => element.id === 'text' ? { ...element, text: 'Edited', version: 2 } : element)
  next.push({ id: 'deleted', type: 'line', version: 1, isDeleted: true })
  act(() => state.props.onChange(next, { selectedElementIds: {} }, { file: {} }))
  expect(onSave).toHaveBeenCalledTimes(1)
  expect(onSave.mock.calls[0][0]).toEqual({ edited: { schema_version: 2, elements: [
    { ...elements[0], customData: { ...elements[0].customData, label: 'Edited' } }, ...next.slice(1, 4),
  ] } })
  act(() => state.props.onChange(next, { selectedElementIds: {} }))
  expect(onSave).toHaveBeenCalledTimes(1)
  expect(state.props.UIOptions.tools.image).toBe(false)
})

it('opens version 1 positions and labels without saving until an edit', async () => {
  canvasAPI.get.mockResolvedValue({ data: { id: 7, template: 'flowchart', payload: {}, edited: {
    schema_version: 1, nodes: [{ id: 'old', type: 'StepNode', position: { x: 99, y: 123 }, data: { label: 'Old edit' } }], edges: [],
  } } })
  await open()
  expect(state.props.initialData.elements[0]).toMatchObject({ id: 'old', x: 99, y: 123, customData: { label: 'Old edit' } })
  expect(canvasAPI.update).not.toHaveBeenCalled()
})

it('restores the generated payload after flushing and remounts the scene', async () => {
  canvasAPI.get.mockResolvedValue({ data: { id: 7, template: 'comparison_matrix', payload: {
    options: ['One'], criteria: ['Price'], cells: [{ option: 'One', criterion: 'Price', value: 'Free' }],
  }, edited: { schema_version: 2, elements }, has_edits: true } })
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Restore original' }))
  fireEvent.click(screen.getByRole('button', { name: 'Restore', exact: true }))
  await waitFor(() => expect(state.props.initialData.elements.some(element => element.label?.text === 'Free')).toBe(true))
  expect(canvasAPI.update).toHaveBeenCalledWith(7, { edited: null, layout: null })
})

it('follows the html theme live with the same background in both themes', async () => {
  render(<ExcalidrawSurface elements={elements} onSelectNode={vi.fn()} onSelectionChange={vi.fn()} onSave={vi.fn()} />)
  const updateScene = vi.fn()
  act(() => state.props.excalidrawAPI({ updateScene }))
  expect(state.props.initialData.appState.viewBackgroundColor).toBe('#f3f4f6')
  expect(updateScene).toHaveBeenLastCalledWith({ appState: { theme: 'light', viewBackgroundColor: '#f3f4f6' } })
  await act(async () => document.documentElement.classList.add('dark'))
  expect(state.props.theme).toBe('dark')
  expect(updateScene).toHaveBeenLastCalledWith({ appState: { theme: 'dark', viewBackgroundColor: '#f3f4f6' } })
})

it('uses the light background when opening directly in dark mode', () => {
  document.documentElement.classList.add('dark')
  render(<ExcalidrawSurface elements={elements} onSelectNode={vi.fn()} onSelectionChange={vi.fn()} onSave={vi.fn()} />)
  expect(state.props.initialData.appState).toEqual({ theme: 'dark', viewBackgroundColor: '#f3f4f6' })
})

it.each([0.4, 1, 2])('fits loaded elements once and caps a resulting zoom of %s', async zoom => {
  const props = { elements, onSelectNode: vi.fn(), onSelectionChange: vi.fn(), onSave: vi.fn() }
  const view = render(<ExcalidrawSurface {...props} />)
  const api = { scrollToContent: vi.fn(), getSceneElements: vi.fn(() => elements),
    getAppState: vi.fn(() => ({ zoom: { value: zoom } })), updateScene: vi.fn() }
  act(() => state.props.excalidrawAPI(api))
  act(() => state.props.onChange([], { selectedElementIds: {} }))
  expect(api.scrollToContent).not.toHaveBeenCalled()
  act(() => state.props.onChange(elements, { selectedElementIds: {} }))
  expect(api.scrollToContent).toHaveBeenCalledOnce()
  expect(api.scrollToContent).toHaveBeenCalledWith(elements, { fitToContent: true, viewportZoomFactor: 0.8, animate: false })
  await waitFor(() => expect(api.getAppState).toHaveBeenCalledOnce())
  const zoomChanges = api.updateScene.mock.calls.filter(([payload]) => payload.appState.zoom)
  expect(zoomChanges).toEqual(zoom > 1 ? [[{ appState: { zoom: { value: 1 } } }]] : [])
  view.rerender(<ExcalidrawSurface {...props} elements={[...elements]} />)
  act(() => state.props.onChange(elements, { selectedElementIds: { shape: true }, zoom: { value: 2 } }))
  await act(async () => document.documentElement.classList.add('dark'))
  expect(api.scrollToContent).toHaveBeenCalledOnce()
  expect(api.getAppState).toHaveBeenCalledOnce()
})

it('fits again after Restore remounts the whiteboard', async () => {
  canvasAPI.get.mockResolvedValue({ data: { id: 7, template: 'comparison_matrix', payload: {
    options: ['One'], criteria: ['Price'], cells: [{ option: 'One', criterion: 'Price', value: 'Free' }],
  }, edited: { schema_version: 2, elements } } })
  await open()
  const api = { scrollToContent: vi.fn(), getSceneElements: vi.fn(() => state.props.initialData.elements),
    getAppState: vi.fn(() => ({ zoom: { value: 1 } })), updateScene: vi.fn() }
  act(() => { state.props.excalidrawAPI(api); state.props.onChange(elements, { selectedElementIds: {} }) })
  expect(api.scrollToContent).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Restore original' }))
  fireEvent.click(screen.getByRole('button', { name: 'Restore', exact: true }))
  await waitFor(() => expect(state.props.initialData.elements.some(element => element.label?.text === 'Free')).toBe(true))
  act(() => {
    state.props.excalidrawAPI(api)
    state.props.onChange(state.props.initialData.elements, { selectedElementIds: {} })
  })
  expect(api.scrollToContent).toHaveBeenCalledTimes(2)
})

it('shows the demo note and skips saves including flush and unmount', async () => {
  vi.stubEnv('VITE_DEMO', 'true')
  function Demo() {
    const { save, flush } = useCanvasPersistence(7)
    return <><button onClick={() => { save({ edited: { schema_version: 2, elements } }); flush() }}>Draw</button>
      <CanvasSaveControls status="Saved" retry={vi.fn()} restore={vi.fn()} restoring={false} setRestoring={vi.fn()} hasChanges /></>
  }
  const view = render(<Demo />)
  expect(screen.getByText('Changes stay in this tab. The demo does not save.')).toBeInTheDocument()
  expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Draw' }))
  view.unmount()
  expect(canvasAPI.update).not.toHaveBeenCalled()
})
