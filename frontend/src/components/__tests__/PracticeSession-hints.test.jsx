import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PracticeSession from '../PracticeSession'
import { progressAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  progressAPI: { getReviewSession: vi.fn(), submit: vi.fn() },
}))

const question = {
  id: 1, question_text: 'Name the language.', correct_option: 'A',
  options: [{ option: 'A', text: 'Python' }, { option: 'B', text: 'Java' }],
  explanation: 'Python is the expected answer.',
  source_reference: { section: 'Introduction', text: 'Short excerpt...', passage: 'Full source passage.' },
}
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [question, { ...question, id: 2 }] } })
  progressAPI.submit.mockResolvedValue({ data: { correct: true, gamification: { points_earned: 0, streak_bonus: 0 } } })
})
afterEach(cleanup)
async function open() {
  render(<MemoryRouter><PracticeSession onExit={vi.fn()} onFinished={vi.fn()} onEmpty={vi.fn()} /></MemoryRouter>)
  await screen.findByText(question.question_text)
}
async function answer() {
  fireEvent.click(screen.getByRole('button', { name: /Python/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Show Answer' }))
  expect(screen.queryByRole('button', { name: 'Hint' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Show the passage' })).not.toBeInTheDocument()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Good/ })))
}
it('shows two source hints without changing options or revealing the answer', async () => {
  await open()
  const options = ['Python', 'Java'].map(name => screen.getByRole('button', { name: new RegExp(name) }))
  const before = options.map(option => option.outerHTML)
  fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
  const hint = screen.getByText('Hint 1 of 2: Look at the section “Introduction”')
  expect(hint.parentElement).toHaveAttribute('aria-live', 'polite')
  expect(screen.queryByText('Full source passage.')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Show the passage' }))
  expect(screen.getByText('Hint 2 of 2:')).toBeInTheDocument()
  expect(screen.getByText('Full source passage.').closest('blockquote')).toBeInTheDocument()
  expect(screen.queryByText('Short excerpt...')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Show the passage' })).not.toBeInTheDocument()
  expect(options.map(option => option.outerHTML)).toEqual(before)
  expect(screen.queryByText(question.explanation)).not.toBeInTheDocument()
  await answer()
  expect(progressAPI.submit).toHaveBeenCalledWith(expect.objectContaining({ hint_used: true }))
  await screen.findByRole('button', { name: 'Hint' })
  await answer()
  expect(progressAPI.submit.mock.calls[1][0]).not.toHaveProperty('hint_used')
})
it('records the first hint and shows the helped correct result', async () => {
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
  fireEvent.click(screen.getByRole('button', { name: /Python/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Show Answer' }))
  expect(screen.getByText('Correct, with a hint. It counts towards mastery once you get it without one.')).toBeInTheDocument()
  expect(screen.queryByText(/Hint 1 of 2/)).not.toBeInTheDocument()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Good/ })))
  expect(progressAPI.submit.mock.calls[0][0].hint_used).toBe(true)
})
it('uses the excerpt for older questions and includes a supplied source name', async () => {
  progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [{ ...question, source_name: 'My notes', source_reference: { section: 'Introduction', text: 'Older excerpt.' } }] } })
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
  expect(screen.getByText('Hint 1 of 2: Look at the section “Introduction” in My notes')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Show the passage' }))
  expect(screen.getByText('Older excerpt.')).toBeInTheDocument()
})
it('hides hints in written and explain modes', async () => {
  await open()
  for (const mode of ['written', 'explain']) {
    fireEvent.change(screen.getByLabelText('Answer mode'), { target: { value: mode } })
    expect(screen.queryByRole('button', { name: 'Hint' })).not.toBeInTheDocument()
  }
})
it('hides the control when there is no source section or passage', async () => {
  progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [{ ...question, source_reference: {} }] } })
  await open()
  expect(screen.queryByRole('button', { name: 'Hint' })).not.toBeInTheDocument()
})
