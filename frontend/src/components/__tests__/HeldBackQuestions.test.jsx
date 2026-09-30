import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import HeldBackQuestions from '../HeldBackQuestions'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const items = [{
  id: 7, question: 'Which answer?', options: [{ option: 'A', text: 'One' }, { option: 'B', text: 'Two' }],
  correct_answer: ' b ', reasons: ['Ambiguous wording', 'Unsupported answer'],
}, {
  id: 8, question: 'Another question?', options: [{ option: 'A', text: 'Three' }],
  correct_answer: 'A', reasons: ['Unclear'],
}]

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: items })
  api.post.mockResolvedValue({ data: { question_id: 20 } })
})

describe('HeldBackQuestions', () => {
  it('renders questions, reasons, and keyed options', async () => {
    render(<HeldBackQuestions deckId="3" onRestored={vi.fn()} />)
    expect(await screen.findByText('Held back by the quality check (2)')).toBeInTheDocument()
    expect(screen.getByText('Which answer?')).toBeInTheDocument()
    expect(screen.getByText('Ambiguous wording')).toBeInTheDocument()
    expect(screen.getByText('Unsupported answer')).toBeInTheDocument()
    expect(screen.getByText('B. Two').textContent).toContain('(Keyed answer)')
    expect(screen.getByText('A. One').textContent).not.toContain('(Keyed answer)')
    expect(api.get).toHaveBeenCalledWith('/flagged', { params: { deck_id: '3' } })
  })

  it('restores, removes the item, and reloads the deck', async () => {
    const onRestored = vi.fn()
    render(<HeldBackQuestions deckId="3" onRestored={onRestored} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Restore question 7' }))
    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1))
    expect(api.post).toHaveBeenCalledWith('/flagged/7/restore')
    expect(screen.queryByText('Which answer?')).not.toBeInTheDocument()
    expect(screen.getByText('Held back by the quality check (1)')).toBeInTheDocument()
  })

  it('discards and removes the item', async () => {
    const onRestored = vi.fn()
    render(<HeldBackQuestions deckId="3" onRestored={onRestored} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Discard question 7' }))
    await waitFor(() => expect(screen.queryByText('Which answer?')).not.toBeInTheDocument())
    expect(api.post).toHaveBeenCalledWith('/flagged/7/discard')
    expect(onRestored).not.toHaveBeenCalled()
  })

  it('shows the server error and keeps the item', async () => {
    api.post.mockRejectedValue({ originalError: { response: { data: { error: { message: 'Already resolved.' } } } } })
    render(<HeldBackQuestions deckId="3" onRestored={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Restore question 7' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Already resolved.')
    expect(screen.getByText('Which answer?')).toBeInTheDocument()
  })

  it('shows list loading errors', async () => {
    api.get.mockRejectedValue({ response: { data: { error: { message: 'Cannot load.' } } } })
    render(<HeldBackQuestions deckId="3" onRestored={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot load.')
  })

  it('renders nothing for an empty list', async () => {
    api.get.mockResolvedValue({ data: [] })
    const { container } = render(<HeldBackQuestions deckId="3" onRestored={vi.fn()} />)
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))
    expect(container).toBeEmptyDOMElement()
  })
})
