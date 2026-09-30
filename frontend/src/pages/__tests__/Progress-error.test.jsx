import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, it, expect } from 'vitest'
import Progress from '../Progress'
import { progressAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  progressAPI: { getStats: vi.fn() },
  activityAPI: { get: vi.fn().mockResolvedValue({ data: {} }), awards: vi.fn().mockResolvedValue({ data: {} }) },
}))

it('shows the load error and retries successfully', async () => {
  progressAPI.getStats.mockRejectedValueOnce({ originalError: {
    response: { data: { error: { message: 'Service unavailable' } } },
  } }).mockResolvedValueOnce({ data: { questions_due: 4 } })
  render(<MemoryRouter><Progress /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable')
  expect(screen.queryByText('All caught up! Great job!')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Start Review Session')).toBeInTheDocument()
  await waitFor(() => expect(progressAPI.getStats).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
