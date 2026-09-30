import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, it, expect } from 'vitest'
import Decks from '../Decks'
import { decksAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  decksAPI: { list: vi.fn() },
  testsAPI: {},
}))

it('shows the load error and retries successfully', async () => {
  decksAPI.list.mockRejectedValueOnce({ originalError: {
    response: { data: { error: { message: 'Service unavailable' } } },
  } }).mockResolvedValueOnce({ data: [{ id: 1, name: "Science cards", num_questions: 2 }] })
  render(<MemoryRouter><Decks /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable')
  expect(screen.queryByText('No decks yet')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Science cards')).toBeInTheDocument()
  await waitFor(() => expect(decksAPI.list).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
