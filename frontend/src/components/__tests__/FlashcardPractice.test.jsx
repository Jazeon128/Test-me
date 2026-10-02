import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import PracticeSession from '../PracticeSession'
import FlashcardCard from '../FlashcardCard'
import GenerationProgress from '../GenerationProgress'
import { progressAPI, decksAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  progressAPI: { getReviewSession: vi.fn(), submit: vi.fn() },
  decksAPI: { get: vi.fn() },
}))

const card = { id: 7, card_type: 'flashcard', question_text: 'Front?', explanation: 'Back.',
  source_reference: { passage: 'Source text.' } }
const question = { id: 8, card_type: 'mcq', question_text: 'Question?', correct_option: 'A',
  options: [{ option: 'A', text: 'Answer' }], explanation: 'Explanation.' }
const callbacks = () => ({ onExit: vi.fn(), onFinished: vi.fn(), onEmpty: vi.fn() })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [card] } })
  progressAPI.submit.mockImplementation(async ({ manual_quality }) => ({ data: {
    correct: manual_quality >= 3, gamification: { points_earned: 0, streak_bonus: 0 },
  } }))
})
afterEach(() => vi.useRealTimers())

describe('Flashcard practice', () => {
  it('reveals by button, focuses Good, and displays the source passage', () => {
    render(<FlashcardCard question={card} onRate={vi.fn()} submitting={false} />)
    expect(screen.getByRole('button', { name: 'Show answer' })).toHaveFocus()
    expect(screen.queryByText('Back.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }))
    expect(screen.getByText('Back.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Good, key 3' })).toHaveFocus()
    fireEvent.click(screen.getByText('Source passage'))
    expect(screen.getByText('Source text.')).toBeInTheDocument()
  })

  it.each([' ', 'Enter'])('reveals with %s', key => {
    render(<FlashcardCard question={card} onRate={vi.fn()} submitting={false} />)
    fireEvent.keyDown(window, { key })
    expect(screen.getByText('Back.')).toBeInTheDocument()
  })

  it.each([[1, 1], [2, 3], [3, 4], [4, 5]])('key %s rates only after reveal', (key, quality) => {
    const onRate = vi.fn()
    render(<FlashcardCard question={card} onRate={onRate} submitting={false} />)
    fireEvent.keyDown(window, { key: String(key) })
    expect(onRate).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: ' ' })
    fireEvent.keyDown(window, { key: String(key) })
    expect(onRate).toHaveBeenCalledWith(quality)
  })

  it('ignores shortcuts in text fields and while submitting', () => {
    const onRate = vi.fn()
    const { rerender } = render(<><input aria-label="Notes" /><FlashcardCard question={card} onRate={onRate} /></>)
    fireEvent.keyDown(screen.getByLabelText('Notes'), { key: ' ' })
    expect(screen.queryByText('Back.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }))
    fireEvent.keyDown(screen.getByLabelText('Notes'), { key: '3' })
    expect(onRate).not.toHaveBeenCalled()
    rerender(<><input aria-label="Notes" /><FlashcardCard question={card} onRate={onRate} submitting /></>)
    fireEvent.keyDown(window, { key: '3' })
    expect(onRate).not.toHaveBeenCalled()
  })

  it('submits only the rating payload with elapsed time and shows final counts', async () => {
    vi.useFakeTimers()
    progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [card, { ...card, id: 9 }] } })
    const props = callbacks()
    await act(async () => render(<PracticeSession {...props} />))
    expect(screen.queryByLabelText('Answer mode')).not.toBeInTheDocument()
    expect(screen.queryByText('30s')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(120000))
    expect(screen.queryByText('Back.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Again, key 1' })))
    expect(progressAPI.submit).toHaveBeenNthCalledWith(1, {
      question_id: 7, selected_option: '', time_taken_seconds: 120, manual_quality: 1,
    })
    expect(screen.getByRole('button', { name: 'Show answer' })).toHaveFocus()
    fireEvent.keyDown(window, { key: ' ' })
    await act(async () => fireEvent.keyDown(window, { key: '2' }))
    expect(statValue('Recalled')).toBe('0')
    expect(statValue('To review')).toBe('2')
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
    expect(props.onFinished).toHaveBeenCalledTimes(1)
  })

  it('stops the question timer for a card and restarts it for the next question', async () => {
    vi.useFakeTimers()
    progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [question, card, { ...question, id: 10 }] } })
    await act(async () => render(<PracticeSession {...callbacks()} />))
    fireEvent.click(screen.getByLabelText('30 s timer'))
    expect(screen.getByText('Correct or recalled')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.getByText('20s')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Answer'))
    fireEvent.click(screen.getByRole('button', { name: 'Show Answer' }))
    await act(async () => fireEvent.click(screen.getByText('Good')))
    expect(screen.queryByLabelText('Answer mode')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(60000))
    expect(screen.queryByText('Back.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }))
    await act(async () => fireEvent.keyDown(window, { key: '3' }))
    // Allow the existing question entrance animation to finish.
    act(() => vi.advanceTimersByTime(500))
    expect(screen.getByLabelText('Answer mode')).toBeInTheDocument()
    expect(screen.getByText('30s')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText('29s')).toBeInTheDocument()
  })

  it.each([[2, 'Nothing is due in this deck. Come back later.'],
    [0, 'This deck has no questions yet. Generate some in the Studio.']])('uses deck count %s for empty wording', async (count, text) => {
    progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [] } })
    decksAPI.get.mockResolvedValue({ data: { num_questions: count } })
    render(<PracticeSession deckId="1" embedded {...callbacks()} />)
    expect(await screen.findByText(text)).toBeInTheDocument()
  })

  it('keeps a failed rating available for retry', async () => {
    progressAPI.submit.mockRejectedValue(new Error('Try later'))
    render(<PracticeSession {...callbacks()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Show answer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Good, key 3' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Try later')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Good, key 3' })).toBeEnabled())
  })

  it('uses a 180 ms flip and an instant reduced-motion swap', () => {
    const css = readFileSync('src/index.css', 'utf8')
    expect(css).toMatch(/flashcard-face[^}]*animation: flashcard-flip 180ms/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.flashcard-face \{ animation: none; transform: none;/)
  })

  it.each([['flashcards', 'Generating cards', 'Cards 2 of 5'],
    ['quiz', 'Generating questions', 'Section 2 of 5']])('labels %s generation', (kind, title, count) => {
    render(<GenerationProgress status={{ kind, current_question: 2, total_questions: 5 }} />)
    expect(screen.getByText(title)).toBeInTheDocument()
    expect(screen.getByText(count)).toBeInTheDocument()
  })
})

const statValue = label => within(screen.getByText(label).parentElement.parentElement).getByText(/^\d+$/).textContent

it('counts Good and Easy as recalled, resets the streak for Hard and Again, and omits points', async () => {
  progressAPI.getReviewSession.mockResolvedValue({ data: { questions: Array.from({ length: 5 }, (_, id) => ({ ...card, id })) } })
  progressAPI.submit.mockResolvedValue({ data: { correct: false, gamification: { points_earned: 0, streak_bonus: 0 } } })
  render(<PracticeSession {...callbacks()} />)
  await screen.findByRole('button', { name: 'Show answer' })
  expect(statValue('Recalled')).toBe('0')
  expect(screen.queryByText('Points')).not.toBeInTheDocument()
  const ratings = [['Good, key 3', 1, 1], ['Easy, key 4', 2, 2], ['Hard, key 2', 2, 0], ['Again, key 1', 2, 0]]
  for (const [name, recalled, streak] of ratings) {
    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name })))
    expect(statValue('Recalled')).toBe(String(recalled))
    expect(statValue('Streak')).toBe(String(streak))
  }
  fireEvent.click(screen.getByRole('button', { name: 'Show answer' }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Good, key 3' })))
  expect(statValue('Recalled')).toBe('3')
  expect(statValue('To review')).toBe('2')
  expect(screen.queryByText('Points')).not.toBeInTheDocument()
  expect(progressAPI.submit.mock.calls.map(([payload]) => payload.manual_quality)).toEqual([4, 5, 3, 1, 4])
})

it.each([false, true])('keeps quiz statistics and includes recall in mixed sessions: %s', async mixed => {
  progressAPI.getReviewSession.mockResolvedValue({ data: { questions: mixed ? [card, question] : [question] } })
  progressAPI.submit.mockImplementation(async ({ question_id }) => ({ data: { correct: question_id === question.id, gamification: { points_earned: question_id === question.id ? 10 : 0, streak_bonus: 0 } } }))
  render(<PracticeSession {...callbacks()} />)
  await screen.findByText(mixed ? card.question_text : question.question_text)
  const label = mixed ? 'Correct or recalled' : 'Correct'
  expect(statValue(label)).toBe('0')
  expect(statValue('Points')).toBe('0')
  if (mixed) {
    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Easy, key 4' })))
    await screen.findByText(question.question_text)
    expect(statValue(label)).toBe('1')
  }
  fireEvent.click(screen.getByRole('button', { name: /A\. Answer/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Show Answer' }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Good/ })))
  expect(statValue(label)).toBe(String(mixed ? 2 : 1))
  expect(statValue('Incorrect')).toBe('0')
  expect(statValue('Points')).toBe('10')
})

it('keeps every rating accessible name and displays key hints', () => {
  render(<FlashcardCard question={card} onRate={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Show answer' }))
  for (const [index, label] of ['Again', 'Hard', 'Good', 'Easy'].entries()) {
    expect(screen.getByRole('button', { name: `${label}, key ${index + 1}` })).toHaveTextContent(`${label} · ${index + 1}`)
  }
})
