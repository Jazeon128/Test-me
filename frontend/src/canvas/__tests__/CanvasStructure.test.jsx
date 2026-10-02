import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import PropTypes from 'prop-types'
import Canvas from '../../pages/Canvas'
import { canvasAPI } from '../../services/api'

const state = vi.hoisted(() => ({ save: vi.fn(), convert: vi.fn(point => point), flow: null }))
vi.mock('../useCanvasSave', () => ({ default: () => ({
  status: 'Saved', save: state.save, flush: vi.fn(), retry: vi.fn(),
}) }))
vi.mock('../../services/api', () => ({
  canvasAPI: { get: vi.fn(), nodeSource: vi.fn() },
  documentsAPI: {}, notebooksAPI: {}, statusAPI: {},
}))
vi.mock('../layout', () => ({ toGraph: (_, payload) => payload, layout: async (_, graph) => graph }))
vi.mock('../NodePanel', () => ({ default: () => <aside>Source panel</aside> }))
vi.mock('@xyflow/react', async () => {
  const { useState, useEffect } = await import('react')
  const useGraphState = () => {
    const [items, setItems] = useState([])
    return [items, setItems, () => {}]
  }
  function Flow(props) {
    state.flow = props
    const { onInit } = props
    useEffect(() => { onInit({ screenToFlowPosition: state.convert }) }, [onInit])
    return <div>
      {props.nodes.map(node => {
        const Component = props.nodeTypes[node.type]
        return <div key={node.id} data-testid={node.id}
          onClick={event => props.onNodeClick(event, node)}>
          <Component data={node.data} selected={node.selected} />
        </div>
      })}
      {props.edges.map(edge => <button key={edge.id} onClick={event => props.onEdgeClick(event, edge)}>
        Edge {edge.id}
      </button>)}
    </div>
  }
  Flow.propTypes = { nodes: PropTypes.array, edges: PropTypes.array, nodeTypes: PropTypes.object,
    onInit: PropTypes.func, onNodeClick: PropTypes.func, onEdgeClick: PropTypes.func }
  return { ReactFlow: Flow, useNodesState: useGraphState, useEdgesState: useGraphState,
    Handle: () => <span data-testid="handle" />, Position: { Left: 'left', Right: 'right' },
    Background: () => null, Controls: () => null, BackgroundVariant: { Dots: 'dots' } }
})
const node = (id, type = 'StepNode', extra = {}) => ({
  id, type, position: { x: 10, y: 20 }, data: { label: id, color: 'slate' }, ...extra,
})
const graph = { schema_version: 1, nodes: [node('a'), node('b')],
  edges: [{ id: 'ab', source: 'a', target: 'b' }] }
beforeEach(() => {
  vi.clearAllMocks()
  state.convert.mockImplementation(point => ({ x: point.x - 10, y: point.y - 20 }))
  canvasAPI.nodeSource.mockResolvedValue({ data: { section: null } })
})
async function setup(edited = graph) {
  canvasAPI.get.mockResolvedValue({ data: {
    id: 7, template: 'flowchart', request_text: 'Draw', edited, has_edits: Boolean(edited), payload: graph,
  } })
  const view = render(<MemoryRouter initialEntries={['/canvas/7']}>
    <Routes><Route path="/canvas/:canvasId" element={<Canvas />} /></Routes>
  </MemoryRouter>)
  await screen.findByText('a')
  return view
}
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
const saved = () => state.save.mock.calls.at(-1)[0].edited

it('converts an unedited graph with one save, places and selects additions, and opens their editor', async () => {
  const { container } = await setup(null)
  expect(screen.getByRole('toolbar', { name: 'Canvas tools' })).toBeInTheDocument()
  const wrapper = container.querySelector('.tm-flow-editor')
  vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 50, width: 600, height: 400 })
  click('Add node')
  expect(state.convert).toHaveBeenCalledWith({ x: 400, y: 250 })
  expect(state.save).toHaveBeenCalledTimes(1)
  const added = saved().nodes.at(-1)
  expect(added.id).toMatch(/^n-[0-9a-f-]{36}$/)
  expect(added.position).toEqual({ x: 390, y: 230 })
  expect(added.data).toEqual({ label: 'New node', color: 'slate', kind: 'added', added: true })
  expect(saved().nodes[0].position).toEqual(graph.nodes[0].position)
  expect(saved().edges).toEqual(graph.edges)
  expect(state.flow.nodes.at(-1).selected).toBe(true)
  expect(screen.getByLabelText('Label')).toHaveFocus()
  expect(screen.getByTitle('Added by you. No source passage.')).toHaveTextContent('added')
  expect(screen.queryByText('Source panel')).not.toBeInTheDocument()
  fireEvent.keyDown(screen.getByLabelText('Label'), { key: 'Escape' })
  fireEvent.click(screen.getByText('New node'))
  expect(canvasAPI.nodeSource).not.toHaveBeenCalled()
  expect(screen.queryByText('Source panel')).not.toBeInTheDocument()
  click('Add note')
  expect(state.save).toHaveBeenCalledTimes(2)
  expect(saved().nodes.at(-1)).toMatchObject({ type: 'NoteNode', position: { x: 414, y: 254 },
    data: { label: 'Note', note: true, added: true } })
  expect(screen.getByLabelText('Text')).toHaveFocus()
})

it('adds a note with no handles or citation and validates multiline Text, save and cancel', async () => {
  await setup()
  click('Add note')
  const id = saved().nodes.at(-1).id
  expect(screen.getByTestId(id).querySelector('[data-testid="handle"]')).toBeNull()
  expect(screen.getByTestId(id).querySelector('.tm-cite')).toBeNull()
  const text = screen.getByLabelText('Text')
  for (const value of ['', ' ', 'x'.repeat(401)]) {
    fireEvent.change(text, { target: { value } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.keyDown(text, { key: 'Enter', ctrlKey: true })
    expect(state.save).toHaveBeenCalledTimes(1)
  }
  fireEvent.change(text, { target: { value: 'First\nSecond' } })
  expect(fireEvent.keyDown(text, { key: 'Enter' })).toBe(true)
  expect(state.save).toHaveBeenCalledTimes(1)
  fireEvent.keyDown(text, { key: 'Enter', ctrlKey: true })
  expect(saved().nodes.at(-1).data.label).toBe('First\nSecond')
  expect(state.save).toHaveBeenCalledTimes(2)
  click('Edit')
  fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'x'.repeat(400) } })
  click('Save')
  expect(saved().nodes.at(-1).data.label).toHaveLength(400)
  click('Edit')
  fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Draft' } })
  fireEvent.keyDown(screen.getByLabelText('Text'), { key: 'Escape' })
  expect(state.save).toHaveBeenCalledTimes(3)
  fireEvent.click(screen.getByTestId(id))
  expect(canvasAPI.nodeSource).not.toHaveBeenCalled()
  expect(screen.queryByText('Source panel')).not.toBeInTheDocument()
})

it('connects once and refuses self-loops and duplicate pairs', async () => {
  await setup()
  act(() => state.flow.onConnect({ source: 'a', target: 'a' }))
  act(() => state.flow.onConnect({ source: 'a', target: 'b' }))
  expect(state.save).not.toHaveBeenCalled()
  act(() => state.flow.onConnect({ source: 'b', target: 'a' }))
  expect(state.save).toHaveBeenCalledTimes(1)
  expect(saved().edges.at(-1)).toEqual({ id: expect.stringMatching(/^e-[0-9a-f-]{36}$/), source: 'b', target: 'a' })
  act(() => state.flow.onConnect({ source: 'b', target: 'a' }))
  expect(state.save).toHaveBeenCalledTimes(1)
})

it('deletes a node and its edges through the toolbar', async () => {
  await setup()
  await act(async () => fireEvent.click(screen.getByText('a')))
  click('Delete')
  expect(state.save).toHaveBeenCalledTimes(1)
  expect(saved().nodes.map(item => item.id)).toEqual(['b'])
  expect(saved().edges).toEqual([])
})

it('refuses parent deletion through both the button and keyboard', async () => {
  const { container } = await setup({ ...graph, nodes: [node('a', 'GroupNode'), node('b', 'StepNode', { parentId: 'a' })] })
  await act(async () => fireEvent.click(screen.getByText('a')))
  expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('title', 'Delete what is inside it first.')
  fireEvent.keyDown(container.querySelector('.tm-flow-editor'), { key: 'Delete' })
  expect(state.save).not.toHaveBeenCalled()
})

it.each(['Delete', 'Backspace'])('ignores %s while typing and deletes from the canvas wrapper', async key => {
  const { container } = await setup()
  await act(async () => fireEvent.click(screen.getByText('a')))
  click('Edit')
  fireEvent.keyDown(screen.getByLabelText('Label'), { key })
  fireEvent.keyDown(screen.getByLabelText('Detail'), { key })
  expect(state.save).not.toHaveBeenCalled()
  fireEvent.keyDown(screen.getByLabelText('Label'), { key: 'Escape' })
  const wrapper = container.querySelector('.tm-flow-editor')
  wrapper.focus()
  fireEvent.keyDown(wrapper, { key })
  expect(saved().nodes.map(item => item.id)).toEqual(['b'])
})

it('edits edge labels from 0 to 80 characters, cancels, and deletes edges', async () => {
  await setup()
  click('Edge ab')
  expect(state.flow.edges[0].selectable).toBe(true)
  click('Edit label')
  const input = screen.getByLabelText('Edge label')
  expect(input).toHaveAttribute('maxlength', '80')
  fireEvent.change(input, { target: { value: 'x'.repeat(80) } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(saved().edges[0].label).toHaveLength(80)
  click('Edit label')
  fireEvent.change(screen.getByLabelText('Edge label'), { target: { value: 'draft' } })
  fireEvent.keyDown(screen.getByLabelText('Edge label'), { key: 'Escape' })
  expect(state.save).toHaveBeenCalledTimes(1)
  click('Edit label')
  fireEvent.change(screen.getByLabelText('Edge label'), { target: { value: '' } })
  fireEvent.keyDown(screen.getByLabelText('Edge label'), { key: 'Enter' })
  expect(saved().edges[0].label).toBe('')
  click('Delete')
  expect(saved().edges).toEqual([])
  expect(saved().nodes).toHaveLength(2)
  expect(state.save).toHaveBeenCalledTimes(3)
})

it('recolours through named swatches and marks the node edited with one save', async () => {
  await setup()
  await act(async () => fireEvent.click(screen.getByText('a')))
  click('Colour')
  expect(screen.getAllByRole('menuitemradio')).toHaveLength(6)
  expect(screen.getByRole('menuitemradio', { name: 'slate' })).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'rose' }))
  expect(saved().nodes[0].data).toMatchObject({ color: 'rose', edited: true })
  expect(state.save).toHaveBeenCalledTimes(1)
  click('Colour')
  expect(screen.getByRole('menuitemradio', { name: 'rose' })).toHaveAttribute('aria-checked', 'true')
})

it.each(['MatrixCell', 'MessageNode', 'NoteNode'])('disables Colour for %s', async type => {
  await setup({ ...graph, nodes: [node('a', type), node('b')] })
  await act(async () => fireEvent.click(screen.getByText('a')))
  expect(screen.getByRole('button', { name: 'Colour' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Colour' }).title).toContain('meaning')
})

it.each([true, false])('saves every moved position when has_edits is %s', async edited => {
  await setup(edited ? graph : null)
  const moved = [node('a', 'StepNode', { position: { x: 99, y: 101 } }),
    node('b', 'StepNode', { position: { x: 199, y: 201 } })]
  act(() => state.flow.onNodeDragStop({}, moved[0], moved))
  expect(state.save).toHaveBeenCalledTimes(1)
  const payload = state.save.mock.calls[0][0]
  if (edited) expect(payload.edited.nodes.map(item => item.position)).toEqual(moved.map(item => item.position))
  else expect(payload).toEqual({ layout: { a: moved[0].position, b: moved[1].position } })
})
