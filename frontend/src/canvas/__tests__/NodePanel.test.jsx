import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import Canvas from '../../pages/Canvas'
import { canvasAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  canvasAPI: { get: vi.fn(), nodeSource: vi.fn(), questionsForNode: vi.fn() },
  statusAPI: { get: vi.fn() },
}))
vi.mock('../layout', () => ({
  toGraph: () => ({ nodes: [
    { id: 'A', data: { label: 'Node A' } },
    { id: 'B', data: { label: 'Node B' } },
  ], edges: [] }),
  layout: async (_, graph) => graph,
}))
vi.mock('@xyflow/react', async () => {
  const { useState } = await import('react')
  const { default: PropTypes } = await import('prop-types')
  const useGraphState = () => {
    const [items, setItems] = useState([])
    return [items, setItems, vi.fn()]
  }
  const ReactFlow = ({ nodes }) => <>{nodes.map(node => (
    <button key={node.id} onClick={node.data.onOpenSource}>Open {node.data.label}</button>
  ))}</>
  ReactFlow.propTypes = { nodes: PropTypes.array.isRequired }
  return {
    ReactFlow, Background: () => null, Controls: () => null,
    BackgroundVariant: { Dots: 'dots' }, useNodesState: useGraphState, useEdgesState: useGraphState,
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  canvasAPI.get.mockResolvedValue({ data: {
    id: 7, document_id: 42, request_text: 'Compare nodes', template: 'flowchart', payload: {},
  } })
  canvasAPI.nodeSource.mockImplementation(async (_, id) => ({ data: {
    section: { heading: `Source ${id}`, text: `Passage ${id}` },
  } }))
})

async function open() {
  render(<MemoryRouter initialEntries={['/canvas/7']}>
    <Routes><Route path="/canvas/:canvasId" element={<Canvas />} /></Routes>
  </MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Open Node A' }))
  await screen.findByText('Passage A')
}

it('removes node A questions when the Canvas parent selects node B', async () => {
  canvasAPI.questionsForNode.mockResolvedValue({ data: {
    questions: [{ question: 'Question for A', options: [] }],
  } })
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Test me on this' }))
  await screen.findByText('Question for A')
  expect(canvasAPI.questionsForNode).toHaveBeenCalledWith(7, 'A')
  fireEvent.click(screen.getByRole('button', { name: 'Open Node B' }))
  await screen.findByText('Passage B')
  expect(screen.queryByText('Question for A')).not.toBeInTheDocument()
})

it('shows the backend error.message when question generation fails', async () => {
  canvasAPI.questionsForNode.mockRejectedValue({ response: { data: {
    error: { message: 'Question generation is unavailable.' },
  } } })
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Test me on this' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Question generation is unavailable.')
})
