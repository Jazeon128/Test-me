import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import PropTypes from 'prop-types'
import Canvas from './CanvasRouteHarness'
import { canvasAPI } from '../../services/api'
import { layout, toGraph } from '../layout'

vi.mock('../../services/api', () => ({
  canvasAPI: { get: vi.fn(), update: vi.fn(), nodeSource: vi.fn(), nodeQuestions: vi.fn() },
  documentsAPI: {},
  notebooksAPI: {},
  statusAPI: {},
}))
vi.mock('../layout', async importOriginal => ({ ...(await importOriginal()), toGraph: vi.fn(), layout: vi.fn() }))
vi.mock('../NodePanel', () => ({ default: () => <div data-testid="source-panel" /> }))
vi.mock('@xyflow/react', async () => {
  const { useState } = await import('react')
  const useGraphState = () => {
    const [nodes, setNodes] = useState([])
    return [nodes, setNodes, () => {}]
  }
  function Flow({ nodes, nodeTypes, onNodeClick, onNodeDoubleClick, onNodeDragStop, deleteKeyCode }) {
    return (
      <div data-testid="flow" data-delete-key={String(deleteKeyCode)}>
        {nodes.map(node => {
          const Component = nodeTypes[node.type]
          return (
            <div
              key={node.id}
              data-testid={`node-${node.id}`}
              onClick={event => onNodeClick(event, node)}
              onDoubleClick={event => onNodeDoubleClick(event, node)}
            >
              <Component data={node.data} selected={node.selected} />
              <button
                onClick={event => {
                  event.stopPropagation()
                  onNodeDragStop(event, { ...node, position: { x: 99, y: 101 } })
                }}
              >
                Drag {node.id}
              </button>
            </div>
          )
        })}
      </div>
    )
  }
  Flow.propTypes = {
    nodes: PropTypes.array,
    nodeTypes: PropTypes.object,
    onNodeClick: PropTypes.func,
    onNodeDoubleClick: PropTypes.func,
    onNodeDragStop: PropTypes.func,
    deleteKeyCode: PropTypes.any,
  }
  return {
    ReactFlow: Flow,
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
    Position: { Left: 'left', Right: 'right' },
    BackgroundVariant: { Dots: 'dots' },
    useNodesState: useGraphState,
    useEdgesState: useGraphState,
  }
})
const node = {
  id: 'n',
  type: 'StepNode',
  position: { x: 10, y: 20 },
  data: { label: 'Original', detail: 'Original detail', source_section_id: 's' },
}
const record = {
  id: 7,
  document_id: 42,
  request_text: 'Diagram',
  template: 'flowchart',
  payload: {},
  edited: { schema_version: 1, nodes: [node], edges: [] },
  has_edits: true,
}
beforeEach(() => {
  vi.clearAllMocks()
  canvasAPI.get.mockResolvedValue({ data: structuredClone(record) })
  canvasAPI.update.mockResolvedValue({ data: {} })
  canvasAPI.nodeSource.mockResolvedValue({ data: { section: null } })
  toGraph.mockReturnValue({ nodes: [{ ...node, data: { label: 'Generated' } }], edges: [] })
  layout.mockImplementation(async (_, graph) => graph)
})
function Navigation() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/')}>Leave</button>
}
async function setup() {
  const result = render(
    <MemoryRouter initialEntries={['/canvas/7']}>
      <Routes>
        <Route path="/canvas/:canvasId" element={<Canvas />} />
        <Route path="/" element={<p>Left</p>} />
      </Routes>
      <Navigation />
    </MemoryRouter>
  )
  await screen.findByText('Original')
  return result
}
it('draws an edited graph without layout and opens Edit with a 44 px toolbar', async () => {
  await setup()
  expect(toGraph).not.toHaveBeenCalled()
  expect(layout).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Original'))
  const button = await screen.findByRole('button', { name: 'Edit' })
  expect(button.closest('.tm-edit-toolbar')).toBeInTheDocument()
  fireEvent.click(button)
  await waitFor(() => expect(screen.getByLabelText('Label')).toHaveFocus())
})
it('saves Label with Enter, preserves fields, strips callbacks and shows the edited marker', async () => {
  await setup()
  fireEvent.doubleClick(screen.getByText('Original'))
  fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Corrected' } })
  fireEvent.keyDown(screen.getByLabelText('Label'), { key: 'Enter' })
  expect(screen.getByText('Corrected')).toBeInTheDocument()
  expect(screen.getByText('edited')).toHaveAttribute(
    'title',
    'Edited by you. The source passage supported the original wording.'
  )
  expect(screen.getByText('Saving...')).toHaveAttribute('aria-live', 'polite')
  await waitFor(() => expect(canvasAPI.update).toHaveBeenCalled(), { timeout: 1500 })
  const saved = canvasAPI.update.mock.calls[0][1].edited
  expect(saved.nodes[0]).toEqual({ ...node, data: { ...node.data, label: 'Corrected', edited: true } })
  expect(screen.getByText('Saved')).toBeInTheDocument()
})
it('opens with Enter, cancels with Escape and ignores typing shortcuts', async () => {
  const { container } = await setup()
  await act(async () => fireEvent.click(screen.getByText('Original')))
  fireEvent.keyDown(container.querySelector('.tm-flow-editor'), { key: 'Enter' })
  const label = screen.getByLabelText('Label')
  fireEvent.change(label, { target: { value: 'Draft' } })
  fireEvent.keyDown(label, { key: 'Delete' })
  expect(label).toHaveValue('Draft')
  expect(screen.getByTestId('flow')).toHaveAttribute('data-delete-key', 'null')
  fireEvent.keyDown(label, { key: 'Escape' })
  expect(screen.queryByLabelText('Label')).not.toBeInTheDocument()
  expect(screen.getByText('Original')).toBeInTheDocument()
  expect(canvasAPI.update).not.toHaveBeenCalled()
})
it('validates Label and Detail lengths and keeps Shift+Enter in Detail in the editor', async () => {
  await setup()
  fireEvent.doubleClick(screen.getByText('Original'))
  const label = screen.getByLabelText('Label'),
    detail = screen.getByLabelText('Detail')
  for (const value of ['', ' ', 'x'.repeat(121)]) {
    fireEvent.change(label, { target: { value } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.keyDown(label, { key: 'Enter' })
    expect(canvasAPI.update).not.toHaveBeenCalled()
  }
  fireEvent.change(label, { target: { value: 'x'.repeat(120) } })
  fireEvent.change(detail, { target: { value: 'x'.repeat(401) } })
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  fireEvent.change(detail, { target: { value: 'First\nSecond' } })
  fireEvent.keyDown(detail, { key: 'Enter', shiftKey: true })
  expect(screen.getByLabelText('Detail')).toHaveValue('First\nSecond')
  expect(canvasAPI.update).not.toHaveBeenCalled()
  fireEvent.change(detail, { target: { value: 'x'.repeat(400) } })
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
})
it('shows Retry after failure and retries successfully', async () => {
  canvasAPI.update.mockRejectedValueOnce(new Error('Offline'))
  await setup()
  fireEvent.doubleClick(screen.getByText('Original'))
  fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Correction' } })
  fireEvent.keyDown(screen.getByLabelText('Label'), { key: 'Enter' })
  await screen.findByText('Save failed', {}, { timeout: 1500 })
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText('Saved')
  expect(canvasAPI.update).toHaveBeenCalledTimes(2)
  expect(canvasAPI.update.mock.calls[1]).toEqual(canvasAPI.update.mock.calls[0])
})
it('confirms restore, clears edits and positions and redraws from the payload', async () => {
  await setup()
  fireEvent.click(screen.getByRole('button', { name: 'Restore original' }))
  expect(
    screen.getByText('Restore the generated diagram? Your edits and positions on this canvas will be lost.')
  ).toBeInTheDocument()
  expect(canvasAPI.update).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Restore original' }))
  fireEvent.click(screen.getByRole('button', { name: 'Restore', exact: true }))
  await screen.findByText('Generated')
  expect(canvasAPI.update).toHaveBeenCalledTimes(1)
  expect(canvasAPI.update).toHaveBeenCalledWith(7, { edited: null, layout: null })
  expect(toGraph).toHaveBeenCalledTimes(1)
  expect(toGraph).toHaveBeenCalledWith('flowchart', {})
  expect(layout).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Restore original' })).toHaveFocus()
})
it('flushes unsaved text when navigating away', async () => {
  await setup()
  fireEvent.doubleClick(screen.getByText('Original'))
  fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Correction' } })
  fireEvent.keyDown(screen.getByLabelText('Label'), { key: 'Enter' })
  expect(canvasAPI.update).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
  await screen.findByText('Left')
  expect(canvasAPI.update).toHaveBeenCalledTimes(1)
  expect(canvasAPI.update.mock.calls[0][1].edited.nodes[0].data.label).toBe('Correction')
})
it('saves a drag as an edited graph and preserves its text', async () => {
  await setup()
  fireEvent.click(screen.getByRole('button', { name: 'Drag n' }))
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
  })
  expect(canvasAPI.update.mock.calls[0][1].edited.nodes[0].position).toEqual({ x: 99, y: 101 })
  expect(canvasAPI.update.mock.calls[0][1].edited.nodes[0].data.label).toBe('Original')
})
it.each(['GroupNode', 'ActorNode', 'MessageNode', 'BoneNode', 'MatrixCell'])(
  'edits only Label for %s',
  async type => {
    canvasAPI.get.mockResolvedValueOnce({
      data: { ...record, edited: { ...record.edited, nodes: [{ ...node, type }] } },
    })
    await setup()
    fireEvent.doubleClick(screen.getByText('Original'))
    expect(screen.queryByLabelText('Detail')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Correction' } })
    fireEvent.keyDown(screen.getByLabelText('Label'), { key: 'Enter' })
    expect(screen.getByText('Correction')).toBeInTheDocument()
    expect(screen.getByText('edited')).toBeInTheDocument()
  }
)

it('saves only layout when dragging a generated canvas', async () => {
  canvasAPI.get.mockResolvedValueOnce({
    data: { ...record, edited: null, has_edits: false, layout: { n: { x: 30, y: 40 } } },
  })
  render(
    <MemoryRouter initialEntries={['/canvas/7']}>
      <Routes>
        <Route path="/canvas/:canvasId" element={<Canvas />} />
        <Route path="/" element={<p>Left</p>} />
      </Routes>
      <Navigation />
    </MemoryRouter>
  )
  await screen.findByText('Generated')
  fireEvent.click(screen.getByRole('button', { name: 'Drag n' }))
  fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
  await screen.findByText('Left')
  expect(canvasAPI.update.mock.calls).toEqual([[7, { layout: { n: { x: 99, y: 101 } } }]])
})

it('loads old matrix headers without saving and supports header editing and deletion without sources or recolour', async () => {
  canvasAPI.get.mockResolvedValueOnce({ data: { ...record, template: 'comparison_matrix', payload: { options: ['Athena'], criteria: ['Purpose'] } } })
  await setup()
  expect(canvasAPI.update).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Athena'))
  expect(canvasAPI.nodeSource).not.toHaveBeenCalled()
  expect(screen.queryByTestId('source-panel')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Colour' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Athena edited' } })
  fireEvent.keyDown(screen.getByLabelText('Label'), { key: 'Enter' })
  expect(screen.getByText('Athena edited')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(screen.queryByText('Athena edited')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
  await screen.findByText('Left')
  expect(canvasAPI.update.mock.calls[0][1].edited.nodes.some(node => node.id === 'row-0')).toBe(true)
})
