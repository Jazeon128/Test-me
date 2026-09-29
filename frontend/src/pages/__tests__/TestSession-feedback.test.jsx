import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import TestSession from '../TestSession'
import { progressAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  progressAPI: { getReviewSession: vi.fn(), submit: vi.fn() },
}))

const question = {
  id: 1, question_text: 'Why does ice float?', correct_option: 'A',
  options: [{ option: 'A', text: 'It is less dense than water' }, { option: 'B', text: 'Magic' }],
  explanation: 'Ice is less dense than liquid water.',
}

const finalResult = (grade) => ({ data: {
  retry: false, correct: grade.passed, explanation: question.explanation, written_grade: grade,
  gamification: { points_earned: 0, streak_bonus: 0 },
} })

beforeEach(() => {
  vi.clearAllMocks()
  progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [question] } })
})

async function open(mode, text) {
  render(<MemoryRouter><TestSession /></MemoryRouter>)
  await screen.findByText(question.question_text)
  fireEvent.change(screen.getByLabelText('Answer mode'), { target: { value: mode } })
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } })
}

describe('Hint before answer', () => {
  it('shows a hint without the answer, then retries as the final attempt', async () => {
    progressAPI.submit
      .mockResolvedValueOnce({ data: { retry: true, feedback: { hint: 'Compare the densities.' } } })
      .mockResolvedValueOnce(finalResult({ quality: 3, passed: true, expected_answer: 'It is less dense than water' }))
    await open('written', 'It is cold')

    fireEvent.click(screen.getByText('Submit written answer'))

    expect(await screen.findByText('Compare the densities.')).toBeInTheDocument()
    expect(screen.queryByText(/Expected answer/)).not.toBeInTheDocument()
    expect(progressAPI.submit.mock.calls[0][0]).toMatchObject({ retry_allowed: true, after_feedback: false, explain: false })
    expect(screen.getByRole('textbox')).toBeEnabled()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ice is less dense' } })
    fireEvent.click(screen.getByText('Try again'))

    await screen.findByText(/Expected answer: It is less dense than water/)
    expect(screen.getByText(/capped at 3/)).toBeInTheDocument()
    expect(progressAPI.submit.mock.calls[1][0]).toMatchObject({ retry_allowed: false, after_feedback: true })
  })

  it('a first-try pass goes straight to the result', async () => {
    progressAPI.submit.mockResolvedValueOnce(finalResult({ quality: 5, passed: true, expected_answer: 'x' }))
    await open('written', 'Less dense')

    fireEvent.click(screen.getByText('Submit written answer'))

    await screen.findByText(/Score: 5\/5/)
    expect(screen.queryByText(/capped/)).not.toBeInTheDocument()
    expect(progressAPI.submit).toHaveBeenCalledTimes(1)
  })
})

describe('Explain it', () => {
  it('points at flagged sentences and the coverage count without naming missed points', async () => {
    progressAPI.submit.mockResolvedValueOnce({ data: { retry: true, feedback: {
      points_covered: 1, points_total: 3,
      sentences: [
        { index: 0, text: 'Ice floats.', wrong: false, unclear: false },
        { index: 1, text: 'It is heavier than water.', wrong: true, unclear: false },
      ],
    } } })
    await open('explain', 'Ice floats. It is heavier than water.')

    fireEvent.click(screen.getByText('Check my explanation'))

    expect(await screen.findByText('You covered 1 of 3 key points.')).toBeInTheDocument()
    expect(screen.getByText(/It is heavier than water/, { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText(/may be wrong/)).toBeInTheDocument()
    expect(progressAPI.submit.mock.calls[0][0]).toMatchObject({ explain: true, retry_allowed: true })
  })

  it('shows every key point, covered or missed, on the final attempt', async () => {
    progressAPI.submit
      .mockResolvedValueOnce({ data: { retry: true, feedback: { points_covered: 0, points_total: 2, sentences: [] } } })
      .mockResolvedValueOnce(finalResult({
        quality: 2, passed: false, expected_answer: 'It is less dense than water',
        points: [{ text: 'Less dense than water', covered: true }, { text: 'Hydrogen bonds form a lattice', covered: false }],
      }))
    await open('explain', 'Something')

    fireEvent.click(screen.getByText('Check my explanation'))
    expect(await screen.findByText(/Something important is missing/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Try again'))

    await screen.findByText('Hydrogen bonds form a lattice')
    expect(screen.getByLabelText('Missed')).toBeInTheDocument()
    await waitFor(() => expect(progressAPI.submit).toHaveBeenCalledTimes(2))
  })
})
