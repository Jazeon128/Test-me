import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import PracticeSession from '../PracticeSession'
import { progressAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  decksAPI: { get: vi.fn() },
  progressAPI: { getReviewSession: vi.fn(), submit: vi.fn() },
}))

const question = {
  id: 1, question_text: 'Name the language.', correct_option: 'A',
  options: [{ option: 'A', text: 'Python' }, { option: 'B', text: 'Java' }],
  explanation: 'Python is the expected answer.',
}

beforeEach(() => {
  vi.clearAllMocks()
  progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [question] } })
})
afterEach(() => vi.useRealTimers())

async function openWrittenMode() {
  render(<MemoryRouter><PracticeSession deckId={null} onExit={vi.fn()} onFinished={vi.fn()} onEmpty={vi.fn()} /></MemoryRouter>)
  await screen.findByText(question.question_text)
  fireEvent.change(screen.getByLabelText('Answer mode'), { target: { value: 'written' } })
  fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'Python' } })
}

describe('Written practice', () => {
  it('reveals the back of a flashcard and offers no written modes', async () => {
    progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [{
      id: 7, card_type: 'flashcard', question_text: 'SM-2?', explanation: 'Reviews.',
    }] } })
    render(<MemoryRouter><PracticeSession deckId={null} onExit={vi.fn()} onFinished={vi.fn()} onEmpty={vi.fn()} /></MemoryRouter>)
    await screen.findByText('SM-2?')
    expect(screen.getByText('Front')).toBeInTheDocument()
    expect(screen.queryByText('Reviews.')).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Written answer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Explain it' })).not.toBeInTheDocument()
    expect(screen.queryByText('Untimed')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Answer mode')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }))
    expect(screen.getByText('Back')).toBeInTheDocument()
    expect(screen.getByText('Reviews.')).toBeInTheDocument()
  })

  it('saves the answer once and shows the server grade before continuing', async () => {
    progressAPI.submit.mockResolvedValue({ data: {
      correct: true, explanation: question.explanation,
      written_grade: { quality: 4, expected_answer: 'Python' },
      gamification: { points_earned: 10, streak_bonus: 0 },
    } })
    await openWrittenMode()
    fireEvent.click(screen.getByText('Submit written answer'))
    await screen.findByText(/Score: 4\/5/)
    expect(progressAPI.submit).toHaveBeenCalledTimes(1)
    expect(progressAPI.submit.mock.calls[0][0]).toMatchObject({
      question_id: 1, written_answer: 'Python', selected_option: '',
    })
    expect(progressAPI.submit.mock.calls[0][0].manual_quality).toBeUndefined()
    expect(screen.getByText('Next question')).toBeInTheDocument()
  })

  it('preserves an editable answer when grading is unavailable', async () => {
    progressAPI.submit.mockRejectedValue({ message: 'Grading unavailable' })
    await openWrittenMode()
    fireEvent.click(screen.getByText('Submit written answer'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Grading unavailable')
    expect(screen.getByLabelText('Your answer')).toHaveValue('Python')
    expect(screen.getByLabelText('Your answer')).toBeEnabled()
  })

  it('submits an empty selection when the multiple-choice timer expires', async () => {
    render(<MemoryRouter><PracticeSession deckId={null} onExit={vi.fn()} onFinished={vi.fn()} onEmpty={vi.fn()} /></MemoryRouter>)
    await screen.findByText(question.question_text)
    vi.useFakeTimers()
    // Restart the timer after installing the fake clock.
    fireEvent.change(screen.getByLabelText('Answer mode'), { target: { value: 'written' } })
    fireEvent.change(screen.getByLabelText('Answer mode'), { target: { value: 'choice' } })
    act(() => vi.advanceTimersByTime(30000))
    vi.useRealTimers()
    progressAPI.submit.mockRejectedValue({ message: 'Test stops before saving' })
    fireEvent.click(screen.getByText('Again'))
    await waitFor(() => expect(progressAPI.submit).toHaveBeenCalledTimes(1))
    expect(progressAPI.submit.mock.calls[0][0].selected_option).toBe('')
  })
})

it.each([true, false])('focuses and scrolls completion once with reduced motion=%s', async reduced => {
  const scroll = vi.fn()
  const previous = HTMLElement.prototype.scrollIntoView
  HTMLElement.prototype.scrollIntoView = scroll
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: reduced })
  try {
    progressAPI.submit.mockResolvedValue({ data: { correct: true, explanation: question.explanation, written_grade: { quality: 4 }, gamification: { points_earned: 10, streak_bonus: 0 } } })
    await openWrittenMode()
    fireEvent.click(screen.getByText('Submit written answer'))
    await screen.findByText('Next question')
    fireEvent.click(screen.getByText('Next question'))
    const heading = await screen.findByRole('heading', { name: 'Session complete' })
    expect(heading).toHaveFocus()
    expect(heading).toHaveAttribute('tabindex', '-1')
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(scroll.mock.instances[0]).toBe(heading.parentElement)
    expect(scroll).toHaveBeenCalledWith({ block: 'center', ...(reduced ? {} : { behavior: 'smooth' }) })
  } finally {
    media.mockRestore()
    HTMLElement.prototype.scrollIntoView = previous
  }
})

it('omits notebook context during deck practice', async () => {
  progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [{ ...question, notebooks: [{ id: 1, name: 'Biology' }] }] } })
  render(<MemoryRouter><PracticeSession deckId="7" onExit={vi.fn()} onFinished={vi.fn()} onEmpty={vi.fn()} /></MemoryRouter>)
  await screen.findByText(question.question_text)
  expect(screen.queryByText(/^From /)).not.toBeInTheDocument()
})
