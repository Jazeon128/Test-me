import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import Canvas from './CanvasRouteHarness'
import { canvasAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  canvasAPI: { get: vi.fn(), nodeSource: vi.fn(), questionsForNode: vi.fn(), savedQuestionsForNode: vi.fn() },
  statusAPI: { get: vi.fn() },
}))
vi.mock('../layout', () => ({
  toGraph: () => ({ nodes: [
    { id: 'A', position: { x: 0, y: 0 }, data: { label: 'Node A', source_section_id: 's1' } },
    { id: 'B', position: { x: 200, y: 0 }, data: { label: 'Node B', source_section_id: 's2' } },
  ], edges: [] }),
  layout: async (_, graph) => graph,
}))
vi.mock('@excalidraw/excalidraw', () => {
  const MainMenu = () => null
  MainMenu.DefaultItems = { Export: () => null, Help: () => null }
  return { Excalidraw: ({ initialData, onChange }) => <>{initialData.elements.map(element => (
    <button key={element.id} onClick={() => onChange(initialData.elements, {
      selectedElementIds: { [element.id]: true },
    })}>Open {element.customData.label}</button>
  ))}</>, MainMenu,
  convertToExcalidrawElements: skeletons => skeletons.map(element => ({ ...element, version: 1 })) }
})

beforeEach(() => {
  vi.clearAllMocks()
  canvasAPI.savedQuestionsForNode.mockResolvedValue({ data: { questions: [], held_back: 0 } })
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
  await screen.findByText('Passage A…')
  await screen.findByRole('button', { name: 'Test me on this' })
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
  await screen.findByText('Passage B…')
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
