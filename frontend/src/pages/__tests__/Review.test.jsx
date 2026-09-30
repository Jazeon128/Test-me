import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import Review from '../Review'
import { progressAPI } from '../../services/api'

vi.mock('../../services/api', () => ({ progressAPI: { getReviewSession: vi.fn(), submit: vi.fn() } }))
const question = { id: 1, question_text: 'Name the language.', correct_option: 'A',
  options: [{ option: 'A', text: 'Python' }], explanation: 'Python.' }
beforeEach(() => {
  vi.resetAllMocks()
  progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [question] } })
  progressAPI.submit.mockResolvedValue({ data: { correct: true, gamification: { points_earned: 0, streak_bonus: 0 } } })
})
function mount() {
  render(<MemoryRouter initialEntries={['/review']}><Routes>
    <Route path="/review" element={<Review />} /><Route path="/" element={<p>Home</p>} />
  </Routes></MemoryRouter>)
}
it('shows the empty state and links home', async () => {
  progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [] } })
  mount()
  expect(await screen.findByText('Nothing is due. Come back later.')).toBeInTheDocument()
  expect(progressAPI.getReviewSession).toHaveBeenCalledWith(50, true, true, null)
  expect(screen.getByRole('link', { name: 'Back to notebooks' })).toHaveAttribute('href', '/')
})
it('finishes all-due practice at home', async () => {
  mount()
  await screen.findByText(question.question_text)
  fireEvent.click(screen.getByRole('button', { name: /Python/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Show Answer' }))
  fireEvent.click(screen.getByRole('button', { name: /Good/ }))
  expect(await screen.findByText('Home')).toBeInTheDocument()
  await waitFor(() => expect(progressAPI.submit).toHaveBeenCalledTimes(1))
})
it('exits to home', async () => {
  mount()
  await screen.findByText(question.question_text)
  fireEvent.click(screen.getByRole('button', { name: /Exit/ }))
  expect(await screen.findByText('Home')).toBeInTheDocument()
})
