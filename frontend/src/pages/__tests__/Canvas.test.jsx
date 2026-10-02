import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { vi, it, expect, beforeEach } from 'vitest'
import Canvas from '../Canvas'
import { canvasAPI, documentsAPI, notebooksAPI, statusAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  canvasAPI: { get: vi.fn(), generate: vi.fn() },
  documentsAPI: { get: vi.fn() },
  notebooksAPI: { get: vi.fn() },
  statusAPI: { get: vi.fn().mockResolvedValue({ data: { status: 'failed', error_message: 'Fixture stopped' } }) },
}))
vi.mock('../../canvas/layout', () => ({
  toGraph: () => ({ nodes: [], edges: [] }),
  layout: async (_, graph) => graph,
}))
vi.mock('@xyflow/react', async () => {
  const { useState } = await import('react')
  const useGraphState = () => {
    const [items, setItems] = useState([])
    return [items, setItems, vi.fn()]
  }
  return {
    ReactFlow: () => null, Background: () => null, Controls: () => null,
    BackgroundVariant: { Dots: 'dots' },
    useNodesState: useGraphState,
    useEdgesState: useGraphState,
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  documentsAPI.get.mockResolvedValue({ data: {
    id: 42, notebook_id: 3, notebook_name: 'Biology', display_name: 'How cells work',
  } })
  notebooksAPI.get.mockResolvedValue({ data: { id: 3, name: 'Biology' } })
  canvasAPI.get.mockResolvedValue({ data: {
    id: 7, document_id: 42, request_text: 'Existing canvas', template: 'flowchart', payload: {},
  } })
  canvasAPI.generate.mockResolvedValue({ data: { job_id: 'fixture-job' } })
})

function NavigationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return <><output aria-label="Current URL">{location.pathname}{location.search}</output>
    <button onClick={() => navigate(-1)}>Previous page</button></>
}

function renderCanvas(url, previous = '/') {
  return render(<MemoryRouter initialEntries={[previous, url]} initialIndex={1}>
    <Routes>
      <Route path="/canvas" element={<Canvas />} />
      <Route path="/canvas/:canvasId" element={<Canvas />} />
      <Route path="/notebooks/:notebookId" element={<p>Notebook workspace</p>} />
      <Route path="/" element={<p>Notebook list</p>} />
    </Routes>
    <NavigationProbe />
  </MemoryRouter>)
}

it.each(['/canvas?document=42&notebook=3', '/canvas?document=42'])(
  'shows a notebook back button and source on a new canvas at %s', async (url) => {
    const { container } = renderCanvas(url)
    const back = await screen.findByRole('button', { name: 'Back to Biology' })
    expect(container.querySelector('button, input, [tabindex="0"]')).toBe(back)
    expect(back).toHaveClass('btn-secondary')
    expect(back).toHaveStyle({ minHeight: '44px', minWidth: '44px' })
    expect(screen.getByText('Drawn from')).toHaveClass('sr-only')
    expect(screen.getByText('How cells work')).toHaveAttribute('title', 'How cells work')
    expect(screen.getByText('How cells work')).toHaveClass('truncate')
    fireEvent.keyDown(back, { key: 'Escape' })
    expect(screen.getByLabelText('Current URL')).toHaveTextContent(url)
    fireEvent.click(back)
    expect(screen.getByText('Notebook workspace')).toBeInTheDocument()
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('/notebooks/3')
  }
)

it('keeps the notebook list available while context is unknown or fails', async () => {
  documentsAPI.get.mockRejectedValueOnce(new Error('Unavailable'))
  renderCanvas('/canvas?document=42')
  const back = screen.getByRole('button', { name: 'Back to notebooks' })
  await waitFor(() => expect(documentsAPI.get).toHaveBeenCalledWith('42'))
  fireEvent.click(back)
  expect(screen.getByText('Notebook list')).toBeInTheDocument()
})

it('shows saved canvas context and returns to its notebook', async () => {
  canvasAPI.get.mockResolvedValueOnce({ data: {
    id: 7, document_id: 42, notebook_id: 3, notebook_name: 'Biology',
    document_name: 'raw.pdf', source_name: 'How cells work',
    request_text: 'Existing canvas', template: 'flowchart', template_title: 'Flowchart', payload: {},
  } })
  renderCanvas('/canvas/7')
  const back = await screen.findByRole('button', { name: 'Back to Biology' })
  expect(screen.getByRole('heading', { name: 'Existing canvas' })).toBeInTheDocument()
  expect(screen.getByText('Flowchart')).toBeInTheDocument()
  expect(screen.getByText('How cells work')).toHaveAttribute('title', 'How cells work')
  fireEvent.click(back)
  expect(screen.getByText('Notebook workspace')).toBeInTheDocument()
})

it('replaces the new canvas URL after drawing and reloads the saved canvas', async () => {
  const record = { id: 19, document_id: 42, request_text: 'Generated answer', template: 'flowchart', payload: {} }
  canvasAPI.get.mockResolvedValue({ data: record })
  statusAPI.get.mockResolvedValueOnce({ data: { status: 'completed', result_id: 19 } })
  const view = renderCanvas('/canvas?document=42&notebook=3', '/notebooks/3')
  await screen.findByRole('button', { name: 'Back to Biology' })
  fireEvent.change(screen.getByLabelText('What do you want to see?'), { target: { value: 'Generated answer' } })
  fireEvent.click(screen.getByRole('button', { name: 'Draw it' }))
  await waitFor(() => expect(screen.getByLabelText('Current URL')).toHaveTextContent('/canvas/19'))
  expect(screen.getByRole('heading', { name: 'Generated answer' })).toBeInTheDocument()
  expect(screen.queryByText('Ask something about this document')).not.toBeInTheDocument()
  expect(canvasAPI.get).toHaveBeenCalledTimes(1)
  expect(canvasAPI.generate).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
  expect(screen.getByText('Notebook workspace')).toBeInTheDocument()
  view.unmount()
  renderCanvas('/canvas/19')
  await screen.findByRole('heading', { name: 'Generated answer' })
  expect(canvasAPI.get).toHaveBeenLastCalledWith('19')
  expect(canvasAPI.generate).toHaveBeenCalledTimes(1)
})

it('draws another answer from the source of a reopened canvas', async () => {
  render(<MemoryRouter initialEntries={['/canvas/7']}>
    <Routes><Route path="/canvas/:canvasId" element={<Canvas />} /></Routes>
  </MemoryRouter>)
  await screen.findByText('Existing canvas')
  fireEvent.change(screen.getByLabelText('What do you want to see?'), { target: { value: 'Show the next step' } })
  fireEvent.click(screen.getByRole('button', { name: 'Draw it' }))
  await waitFor(() => expect(canvasAPI.generate).toHaveBeenCalledWith(42, 'Show the next step', null))
})

it.each([
  [{ result_id: 19, deck_id: 7 }, 19],
  [{ deck_id: 7 }, 7],
])('loads a completed canvas from its result id with legacy fallback', async (ids, expected) => {
  statusAPI.get.mockResolvedValueOnce({ data: { status: 'completed', ...ids } })
  render(<MemoryRouter initialEntries={['/canvas/7']}>
    <Routes><Route path="/canvas/:canvasId" element={<Canvas />} /></Routes>
  </MemoryRouter>)
  await screen.findByText('Existing canvas')
  fireEvent.change(screen.getByLabelText('What do you want to see?'), { target: { value: 'Draw next' } })
  fireEvent.click(screen.getByRole('button', { name: 'Draw it' }))
  await waitFor(() => expect(statusAPI.get).toHaveBeenCalledWith('fixture-job'))
  await waitFor(() => expect(canvasAPI.get).toHaveBeenLastCalledWith(expected))
})
