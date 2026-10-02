import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, it, expect } from 'vitest'
import DeckEditor from '../DeckEditor'
import { decksAPI, tagsAPI } from '../../services/api'

vi.mock('../HeldBackQuestions', () => ({ default: () => null }))
vi.mock('../../services/api', () => ({
    decksAPI: { get: vi.fn() },
    questionsAPI: {},
    tagsAPI: { list: vi.fn() },
}))

it('passes the deck notebook to the filter, per-card editor, and add form', async () => {
    decksAPI.get.mockResolvedValue({ data: {
        id: 1, notebook_id: 12, name: 'AWS', kind: 'flashcards', documents: [],
        questions: [{ id: 7, card_type: 'flashcard', question_text: 'Front', explanation: 'Back', tags: [] }],
    } })
    tagsAPI.list.mockResolvedValue({ data: [{ id: 1, name: 'Global', shared: true }] })
    render(<DeckEditor deckId={1} />)
    fireEvent.click(await screen.findByRole('button', { name: /Filter by Tags/ }))
    expect(await screen.findByText('Shared')).toBeInTheDocument()
    expect(tagsAPI.list).toHaveBeenLastCalledWith(12)
    tagsAPI.list.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Tags' }))
    await waitFor(() => expect(tagsAPI.list).toHaveBeenCalledWith(12))
    expect(await screen.findByLabelText('Add a tag')).toBeInTheDocument()
    tagsAPI.list.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }))
    await screen.findByLabelText('Front')
    await waitFor(() => expect(tagsAPI.list).toHaveBeenCalledWith(12))
})
