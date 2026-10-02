import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, it, expect, beforeEach } from 'vitest'
import PracticeSession from '../PracticeSession'
import { notebooksAPI, progressAPI, decksAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  notebooksAPI: { practiceQuestions: vi.fn() },
  progressAPI: { getReviewSession: vi.fn(), submit: vi.fn() },
  decksAPI: { get: vi.fn() },
}))
const questions = [
  { id: 12, card_type: 'flashcard', question_text: 'Selected front', explanation: 'Selected back' },
  { id: 9, card_type: 'mcq', question_text: 'Selected MCQ', correct_option: 'A',
    options: [{ option: 'A', text: 'Answer' }], explanation: 'Explanation' },
]
beforeEach(() => {
  vi.clearAllMocks()
  notebooksAPI.practiceQuestions.mockResolvedValue({ data: { num_questions: 2, questions } })
  progressAPI.submit.mockResolvedValue({ data: { correct: true, gamification: { points_earned: 0, streak_bonus: 0 } } })
})
function mount(props = {}) {
  const callbacks = { onExit: vi.fn(), onFinished: vi.fn(), onEmpty: vi.fn(), ...props }
  render(<MemoryRouter initialEntries={['/notebooks/7?view=practice-selection']}>
    <Routes><Route path="/notebooks/:notebookId" element={<PracticeSession embedded questionIds={[12, 9]} {...callbacks} />} /></Routes>
  </MemoryRouter>)
  return callbacks
}
it('loads the exact selection, preserves mixed item order, and records answers normally', async () => {
  const callbacks = mount()
  await screen.findByText('Selected front')
  expect(notebooksAPI.practiceQuestions).toHaveBeenCalledWith('7', [12, 9])
  expect(progressAPI.getReviewSession).not.toHaveBeenCalled()
  expect(decksAPI.get).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Show answer' }))
  fireEvent.click(screen.getByRole('button', { name: 'Good, key 3' }))
  await screen.findByText('Selected MCQ')
  expect(progressAPI.submit).toHaveBeenCalledWith(expect.objectContaining({ question_id: 12, manual_quality: 4 }))
  fireEvent.click(screen.getByText('Answer'))
  fireEvent.click(screen.getByRole('button', { name: 'Show Answer', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: /Good/ }))
  await screen.findByText('Session complete')
  expect(progressAPI.submit).toHaveBeenLastCalledWith(expect.objectContaining({ question_id: 9, selected_option: 'A' }))
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
  expect(callbacks.onFinished).toHaveBeenCalledTimes(1)
})
it('exits if the selection cannot be loaded and does not fall back to a review session', async () => {
  notebooksAPI.practiceQuestions.mockRejectedValue(new Error('Selection unavailable'))
  const callbacks = mount()
  await waitFor(() => expect(callbacks.onExit).toHaveBeenCalledTimes(1))
  expect(progressAPI.getReviewSession).not.toHaveBeenCalled()
})
