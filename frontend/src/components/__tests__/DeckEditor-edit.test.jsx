import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, it, expect, beforeEach } from 'vitest'
import DeckEditor from '../DeckEditor'
import ArtifactList from '../workspace/ArtifactList'
import { decksAPI, questionsAPI } from '../../services/api'

vi.mock('../HeldBackQuestions', () => ({ default: () => null }))
vi.mock('../TagManager', () => ({ default: () => null, TagBadge: () => null }))
vi.mock('../../services/api', () => ({
    decksAPI: { get: vi.fn() },
    questionsAPI: { create: vi.fn(), update: vi.fn() }, tagsAPI: {},
}))

const options = Array.from({ length: 4 }, (_, index) => ({ text: `Option ${index}`, is_correct: index === 0 }))
const card = { id: 7, card_type: 'flashcard', question_text: 'Old front', explanation: 'Old back', difficulty: 'medium', tags: [] }
function show(item = card, kind = 'quiz') {
    const deck = { id: 1, name: 'Study deck', kind, num_questions: 1, documents: [], questions: [item] }
    decksAPI.get.mockResolvedValue({ data: deck })
    return render(<DeckEditor deckId={1} onBack={vi.fn()} />)
}

beforeEach(() => vi.resetAllMocks())

it('edits a flashcard inline and shows Edited after saving', async () => {
    show()
    const edit = await screen.findByRole('button', { name: 'Edit item 1' })
    expect(edit).toHaveAccessibleName('Edit item 1')
    expect(edit).toHaveClass('min-w-[44px]', 'min-h-[44px]', 'focus-visible:ring-2')
    expect(edit.querySelector('svg.lucide-pencil')).toHaveAttribute('aria-hidden', 'true')
    expect(edit.closest('.group')).toHaveClass('hover:bg-gray-50', 'dark:hover:bg-gray-700/40')
    fireEvent.click(edit)
    fireEvent.change(screen.getByLabelText('Front'), { target: { value: 'Correct front' } })
    fireEvent.change(screen.getByLabelText('Back'), { target: { value: 'Correct back' } })
    questionsAPI.update.mockResolvedValue({ data: { ...card, question_text: 'Correct front', explanation: 'Correct back', source_reference: { edited: true } } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(questionsAPI.update).toHaveBeenCalledWith(7, {
        question_text: 'Correct front', explanation: 'Correct back', difficulty: 'medium',
    }))
    expect(await screen.findByText('Edited')).toBeInTheDocument()
    expect(screen.getByText('Flashcard', { exact: true })).toBeInTheDocument()
    expect(screen.queryByLabelText('Front')).not.toBeInTheDocument()
})

it('cancels changes by Escape or Cancel without saving', async () => {
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit item 1' }))
    fireEvent.change(screen.getByLabelText('Front'), { target: { value: 'Discard' } })
    fireEvent.keyDown(screen.getByLabelText('Front'), { key: 'Escape' })
    expect(screen.queryByLabelText('Front')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit item 1' }))
    expect(screen.getByLabelText('Front')).toHaveValue('Old front')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(questionsAPI.update).not.toHaveBeenCalled()
})

it('edits all question fields and chooses a correct answer', async () => {
    show({ ...card, card_type: 'mcq', options })
    fireEvent.click(await screen.findByRole('button', { name: 'Edit item 1' }))
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'New stem' } })
    fireEvent.change(screen.getByLabelText('Option B'), { target: { value: 'New option' } })
    fireEvent.click(screen.getByLabelText('Correct answer B'))
    fireEvent.change(screen.getByLabelText('Explanation'), { target: { value: 'New explanation' } })
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'easy' } })
    questionsAPI.update.mockResolvedValue({ data: { source_reference: { edited: true } } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(questionsAPI.update).toHaveBeenCalledWith(7, {
        question_text: 'New stem', explanation: 'New explanation', difficulty: 'easy',
        options: options.map((option, index) => ({ text: index === 1 ? 'New option' : option.text, is_correct: index === 1 })),
    }))
})

it('defaults to Flashcard in a flashcards deck and supports the type switch', async () => {
    show(card, 'flashcards')
    fireEvent.click(await screen.findByRole('button', { name: 'Add Card' }))
    expect(screen.getByLabelText('Type')).toHaveValue('flashcard')
    expect(screen.queryByLabelText('Option A')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'mcq' } })
    expect(screen.getByLabelText('Option A')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'flashcard' } })
    fireEvent.change(screen.getByLabelText('Front'), { target: { value: 'Manual front' } })
    fireEvent.change(screen.getByLabelText('Back'), { target: { value: 'Manual back' } })
    questionsAPI.create.mockResolvedValue({ data: { id: 8 } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Card' }))
    await waitFor(() => expect(questionsAPI.create).toHaveBeenCalledWith({ card_type: 'flashcard',
        question_text: 'Manual front', explanation: 'Manual back', difficulty: 'medium', deck_id: 1 }))
})

it('defaults to Question in a quiz deck and displays inline validation and server failures', async () => {
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Add Card' }))
    expect(screen.getByLabelText('Type')).toHaveValue('mcq')
    fireEvent.click(screen.getByRole('button', { name: 'Save Card' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Question is required')
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'flashcard' } })
    fireEvent.change(screen.getByLabelText('Front'), { target: { value: 'x'.repeat(201) } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Card' }))
    expect(screen.getByRole('alert')).toHaveTextContent('200 characters')
    expect(questionsAPI.create).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Front'), { target: { value: 'Front' } })
    fireEvent.change(screen.getByLabelText('Back'), { target: { value: 'Back' } })
    questionsAPI.create.mockRejectedValue({ response: { data: { error: { message: 'Save failed' } } } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Card' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Save failed')
})

it('edits a legacy placeholder as front and back without changing its type', async () => {
    show({ ...card, card_type: 'mcq', options: [{ text: 'Flip to see answer', is_correct: true }] })
    fireEvent.click(await screen.findByRole('button', { name: 'Edit item 1' }))
    expect(screen.getByLabelText('Front')).toHaveValue('Old front')
    expect(screen.getByLabelText('Back')).toHaveValue('Old back')
    expect(screen.queryByLabelText('Option A')).not.toBeInTheDocument()
})

it('uses cards in flashcard artifact counts', () => {
    render(<ArtifactList artifacts={{ decks: [{ id: 1, kind: 'flashcards', name: 'Cards', question_count: 3, due_count: 2 }], canvases: [] }} progress={{}} open={vi.fn()} />)
    expect(screen.getByText('3 cards · 2 due')).toBeInTheDocument()
})
