import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, it, expect } from 'vitest'
import DeckEditor from '../DeckEditor'
import { decksAPI } from '../../services/api'

vi.mock('../HeldBackQuestions', () => ({ default: () => null }))

vi.mock('../../services/api', () => ({
  decksAPI: { get: vi.fn() },
  questionsAPI: {}, tagsAPI: {},
}))

it('shows the load error and retries successfully', async () => {
  decksAPI.get.mockRejectedValueOnce({ originalError: {
    response: { data: { error: { message: 'Service unavailable' } } },
  } }).mockResolvedValueOnce({ data: { id: 1, name: "Science cards", num_questions: 0, questions: [], documents: [] } })
  render(<MemoryRouter><DeckEditor deckId={1} onBack={vi.fn()} /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable')
  expect(screen.queryByText('Science cards')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Science cards')).toBeInTheDocument()
  await waitFor(() => expect(decksAPI.get).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('shows a flashcard front and lets the learner reveal its back', async () => {
  decksAPI.get.mockResolvedValueOnce({ data: {
    id: 1, name: 'Study cards', num_questions: 1, documents: [], questions: [{
      id: 7, card_type: 'flashcard', question_text: 'SM-2?', explanation: 'Reviews.',
      difficulty: 'medium', tags: [],
    }],
  } })
  render(<MemoryRouter><DeckEditor deckId={1} onBack={vi.fn()} /></MemoryRouter>)
  expect(await screen.findByText('SM-2?', { exact: false })).toHaveTextContent('Front: SM-2?')
  const reveal = screen.getByText('Show back')
  expect(reveal.closest('details')).not.toHaveAttribute('open')
  fireEvent.click(reveal)
  expect(screen.getByText('Reviews.', { exact: false })).toHaveTextContent('Back: Reviews.')
})
