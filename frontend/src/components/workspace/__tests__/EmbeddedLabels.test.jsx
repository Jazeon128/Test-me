import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PracticeSession from '../../PracticeSession'
import DeckEditor from '../../DeckEditor'
import { decksAPI, progressAPI } from '../../../services/api'

vi.mock('../../../services/api', () => ({
  decksAPI: { get: vi.fn() }, progressAPI: { getReviewSession: vi.fn() },
  questionsAPI: {}, tagsAPI: {},
}))
vi.mock('../../TagManager', () => ({ default: () => null, TagBadge: () => null }))
vi.mock('../../HeldBackQuestions', () => ({ default: () => null }))
vi.mock('../../QuestionTagEditor', () => ({ default: () => null }))

beforeEach(() => {
  vi.resetAllMocks()
  progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [] } })
  decksAPI.get.mockResolvedValue({ data: { name: 'Cell quiz', questions: [], tags: [] } })
})

describe('Embedded labels', () => {
  it('shows Studio guidance without an Upload button during embedded practice', async () => {
    render(<PracticeSession embedded deckId={9} onExit={vi.fn()} onEmpty={vi.fn()} />)
    expect(await screen.findByText('This deck has no questions yet. Generate some in the Studio.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Upload/ })).not.toBeInTheDocument()
  })
  it('notifies the review owner when standalone practice is empty', async () => {
    const onEmpty = vi.fn()
    render(<PracticeSession deckId={null} onExit={vi.fn()} onEmpty={onEmpty} />)
    await waitFor(() => expect(onEmpty).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button', { name: 'Upload Document' })).not.toBeInTheDocument()
  })
  it('hides embedded editor navigation and uses Add a source wording', async () => {
    render(<DeckEditor embedded deckId={9} onBack={vi.fn()} />)
    expect(await screen.findByText('No questions in this deck yet. Add one manually or add a source!')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to Decks' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Upload a document/i)).not.toBeInTheDocument()
  })
  it('keeps standalone editor navigation, wording and its Back callback', async () => {
    const onBack = vi.fn()
    render(<DeckEditor deckId={9} onBack={onBack} />)
    const back = await screen.findByRole('button', { name: 'Back to Decks' })
    expect(screen.getByText('No questions in this deck yet. Add one manually or upload a document!')).toBeInTheDocument()
    fireEvent.click(back)
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
