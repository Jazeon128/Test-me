import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PracticeSession from '../PracticeSession'
import { progressAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  progressAPI: { getReviewSession: vi.fn(), submit: vi.fn() },
}))
vi.mock('framer-motion', async () => {
  const { default: PropTypes } = await import('prop-types')
  const Div = ({ children, className }) => <div className={className}>{children}</div>
  Div.propTypes = { children: PropTypes.node, className: PropTypes.string }
  const AnimatePresence = ({ children }) => <>{children}</>
  AnimatePresence.propTypes = { children: PropTypes.node }
  return { motion: { div: Div }, AnimatePresence }
})

const question = {
  id: 1, question_text: 'Name the language.', correct_option: 'A',
  options: [{ option: 'A', text: 'Python' }, { option: 'B', text: 'Java' }],
  explanation: 'Python is the expected answer.',
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [question, { ...question, id: 2 }] } })
  progressAPI.submit.mockResolvedValue({ data: {
    correct: true, gamification: { points_earned: 0, streak_bonus: 0 },
  } })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function open() {
  await act(async () => { render(<MemoryRouter><PracticeSession deckId={null} onExit={vi.fn()} onFinished={vi.fn()} onEmpty={vi.fn()} /></MemoryRouter>) })
  expect(screen.getByText(question.question_text)).toBeInTheDocument()
}

it('records the answer after 5 seconds and excludes 40 seconds reading the explanation', async () => {
  await open()
  act(() => vi.advanceTimersByTime(5000))
  fireEvent.click(screen.getByRole('button', { name: /Python/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Show Answer' }))
  expect(screen.getByText(question.explanation)).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(40000))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Good/ })) })
  expect(progressAPI.submit.mock.calls[0][0].time_taken_seconds).toBeCloseTo(5)

  act(() => vi.advanceTimersByTime(2000))
  fireEvent.click(screen.getByRole('button', { name: /Python/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Show Answer' }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Good/ })) })
  expect(progressAPI.submit.mock.calls[1][0].time_taken_seconds).toBeCloseTo(2)
})

it('records 30 seconds on timeout and excludes reading time before grading', async () => {
  await open()
  act(() => vi.advanceTimersByTime(30000))
  expect(screen.getByText(question.explanation)).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(40000))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Again/ })) })
  expect(progressAPI.submit.mock.calls[0][0]).toMatchObject({ selected_option: '' })
  expect(progressAPI.submit.mock.calls[0][0].time_taken_seconds).toBeCloseTo(30)
})
