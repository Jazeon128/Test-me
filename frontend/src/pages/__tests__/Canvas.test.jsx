import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, it, expect, beforeEach } from 'vitest'
import Canvas from '../Canvas'
import { canvasAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  canvasAPI: { get: vi.fn(), generate: vi.fn() },
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
  canvasAPI.get.mockResolvedValue({ data: {
    id: 7, document_id: 42, request_text: 'Existing canvas', template: 'flowchart', payload: {},
  } })
  canvasAPI.generate.mockResolvedValue({ data: { job_id: 'fixture-job' } })
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
