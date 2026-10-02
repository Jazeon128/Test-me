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
  localStorage.clear()
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
  fireEvent.click(screen.getByLabelText('30 s timer'))
  act(() => vi.advanceTimersByTime(1000))
  expect(screen.getByText('29s')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(29000))
  expect(screen.getByText(question.explanation)).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(40000))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Again/ })) })
  expect(progressAPI.submit.mock.calls[0][0]).toMatchObject({ selected_option: '' })
  expect(progressAPI.submit.mock.calls[0][0].time_taken_seconds).toBeCloseTo(30)
})

it('is untimed by default and never reveals or submits after 30 seconds', async () => {
  await open()
  expect(screen.getByText('Untimed')).toBeInTheDocument()
  expect(screen.getByLabelText('30 s timer')).not.toBeChecked()
  act(() => vi.advanceTimersByTime(60000))
  expect(screen.getByText('Untimed')).toBeInTheDocument()
  expect(screen.queryByText(question.explanation)).not.toBeInTheDocument()
  expect(progressAPI.submit).not.toHaveBeenCalled()
})

it('remembers both timer choices across sessions', async () => {
  await open()
  fireEvent.click(screen.getByLabelText('30 s timer'))
  expect(localStorage.getItem('testme.practice.timer')).toBe('true')
  cleanup()
  await open()
  expect(screen.getByLabelText('30 s timer')).toBeChecked()
  expect(screen.getByText('30s')).toBeInTheDocument()
  fireEvent.click(screen.getByLabelText('30 s timer'))
  expect(localStorage.getItem('testme.practice.timer')).toBe('false')
  cleanup()
  await open()
  expect(screen.getByText('Untimed')).toBeInTheDocument()
})

it('works when reading and writing localStorage throw', async () => {
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked') })
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
  try {
    await open()
    expect(screen.getByText('Untimed')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('30 s timer'))
    expect(screen.getByText('30s')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(30000))
    expect(screen.getByText(question.explanation)).toBeInTheDocument()
  } finally { get.mockRestore(); set.mockRestore() }
})

it('shows the timer switch only in multiple choice', async () => {
  await open()
  for (const mode of ['written', 'explain']) {
    fireEvent.change(screen.getByLabelText('Answer mode'), { target: { value: mode } })
    expect(screen.queryByLabelText('30 s timer')).not.toBeInTheDocument()
  }
})
