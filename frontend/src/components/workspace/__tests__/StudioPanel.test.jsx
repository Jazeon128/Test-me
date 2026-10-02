import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import StudioPanel from '../StudioPanel'
import { notebooksAPI } from '../../../services/api'

vi.mock('../../../services/api', () => ({ notebooksAPI: { generate: vi.fn() } }))
beforeEach(() => {
  vi.resetAllMocks()
  notebooksAPI.generate.mockResolvedValue({ data: { job_id: 'new-job' } })
})
function mount() {
  const onCanvas = vi.fn()
  render(<StudioPanel notebookId="7" sourceIds={[9]} jobs={[]} artifacts={{ decks: [], canvases: [] }}
    progress={{ answered_count: 0, due_count: 0 }} refresh={vi.fn()} onJob={vi.fn()} open={vi.fn()} onCanvas={onCanvas} />)
  return onCanvas
}
it('toggles each form with aria-pressed and closes it with Close form', () => {
  const onCanvas = mount()
  const quiz = screen.getByRole('button', { name: 'Quiz' })
  const cards = screen.getByRole('button', { name: 'Flashcards' })
  for (const tile of [quiz, cards]) {
    expect(tile).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(tile)
    expect(tile).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('form')).toBeInTheDocument()
    fireEvent.click(tile)
    expect(tile).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    fireEvent.click(tile)
    fireEvent.click(screen.getByRole('button', { name: 'Close form' }))
    expect(tile).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  }
  expect(screen.getByText('Multiple choice')).toBeInTheDocument()
  expect(screen.getByText('Flip and recall')).toBeInTheDocument()
  expect(screen.getByText('Draw a diagram')).toBeInTheDocument()
  const canvas = screen.getByRole('button', { name: 'Canvas' })
  expect(canvas).not.toHaveAttribute('aria-pressed')
  fireEvent.click(canvas)
  expect(onCanvas).toHaveBeenCalledWith([9])
})
it('labels each kind, keeps the deck name and resets the count when switching', () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Quiz' }))
  const quizForm = screen.getByRole('form', { name: 'New quiz' })
  expect(within(quizForm).getByRole('heading', { level: 3, name: 'New quiz' })).toBeInTheDocument()
  expect(within(quizForm).getByText('Questions with four options, checked against your sources.')).toBeInTheDocument()
  const questions = screen.getByLabelText('Number of questions')
  expect(questions).toHaveValue(10)
  expect(questions).toHaveAttribute('min', '1')
  expect(questions).toHaveAttribute('max', '100')
  expect(screen.getByLabelText('Difficulty')).toHaveValue('mixed')
  expect(screen.getAllByRole('option').map(option => option.value)).toEqual(['easy', 'medium', 'hard', 'mixed'])
  expect(screen.getByRole('button', { name: 'Generate quiz' })).toBeEnabled()
  fireEvent.change(questions, { target: { value: '35' } })
  fireEvent.change(screen.getByLabelText('Deck name (optional)'), { target: { value: 'Cells' } })
  fireEvent.click(screen.getByRole('button', { name: 'Flashcards' }))
  expect(screen.getByRole('button', { name: 'Quiz' })).toHaveAttribute('aria-pressed', 'false')
  const cardsForm = screen.getByRole('form', { name: 'New flashcards' })
  expect(within(cardsForm).getByRole('heading', { level: 3, name: 'New flashcards' })).toBeInTheDocument()
  expect(within(cardsForm).getByText('A term or prompt on the front, the answer on the back.')).toBeInTheDocument()
  const cards = screen.getByLabelText('Number of cards')
  expect(cards).toHaveValue(20)
  expect(cards).toHaveAttribute('min', '1')
  expect(cards).toHaveAttribute('max', '100')
  expect(screen.queryByLabelText('Number of questions')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Difficulty')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Deck name (optional)')).toHaveValue('Cells')
  expect(screen.getByRole('button', { name: 'Generate flashcards' })).toBeEnabled()
  fireEvent.change(cards, { target: { value: '50' } })
  fireEvent.click(screen.getByRole('button', { name: 'Quiz' }))
  expect(screen.getByLabelText('Number of questions')).toHaveValue(10)
  expect(screen.getByLabelText('Deck name (optional)')).toHaveValue('Cells')
})
it('submits the card count and mixed difficulty after a hard quiz selection', async () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Quiz' }))
  fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'hard' } })
  fireEvent.click(screen.getByRole('button', { name: 'Flashcards' }))
  fireEvent.change(screen.getByLabelText('Number of cards'), { target: { value: '27' } })
  fireEvent.change(screen.getByLabelText('Deck name (optional)'), { target: { value: 'Recall' } })
  fireEvent.click(screen.getByRole('button', { name: 'Generate flashcards' }))
  await waitFor(() => expect(notebooksAPI.generate).toHaveBeenCalledWith('7', {
    source_ids: [9], kind: 'flashcards', num_questions: 27, difficulty: 'mixed',
    custom_prompt: '', deck_name: 'Recall', allow_unteachable: false,
  }))
})

it.each(['Quiz', 'Flashcards'])('describes 1, 3 and 0 selected sources for %s', tile => {
  const sources = [
    { id: 1, display_name: 'Cells.pdf', status: 'ready' },
    { id: 2, display_name: 'Notes.md', status: 'ready' },
    { id: 3, display_name: 'Lecture.pdf', status: 'ready' },
    { id: 4, display_name: 'Reading.pdf', status: 'processing' },
  ]
  const props = { notebookId: '7', sources, jobs: [], artifacts: { decks: [], canvases: [] }, progress: {}, refresh: vi.fn(), onJob: vi.fn(), open: vi.fn() }
  const rendered = render(<StudioPanel {...props} sources={sources.slice(0, 2)} sourceIds={[1]} />)
  fireEvent.click(screen.getByRole('button', { name: tile }))
  expect(screen.getByText('Uses 1 of 2 sources: Cells.pdf')).toBeInTheDocument()
  rendered.rerender(<StudioPanel {...props} sourceIds={[1, 2, 3]} />)
  expect(screen.getByText('Uses 3 of 4 sources: Cells.pdf, Notes.md and 1 more')).toBeInTheDocument()
  rendered.rerender(<StudioPanel {...props} sourceIds={[]} />)
  expect(screen.getByText('Tick a ready source in Sources first.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: tile === 'Quiz' ? 'Generate quiz' : 'Generate flashcards' })).toBeDisabled()
})
