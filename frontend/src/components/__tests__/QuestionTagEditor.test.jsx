import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import QuestionTagEditor from '../QuestionTagEditor'
import { questionsAPI, tagsAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  questionsAPI: { suggestTags: vi.fn() },
  tagsAPI: { addToQuestion: vi.fn(), removeFromQuestion: vi.fn() },
}))

const python = { id: 1, name: 'Python', color: 'blue' }
const loops = { id: 2, name: 'Loops', color: 'green' }
const typing = { id: 3, name: 'Typing', color: 'red' }
const allTags = [python, loops, typing]

function renderEditor(tags = [typing]) {
  const onChange = vi.fn()
  render(<QuestionTagEditor question={{ id: 7, tags }} allTags={allTags} onChange={onChange} />)
  return onChange
}

beforeEach(() => {
  vi.clearAllMocks()
  tagsAPI.addToQuestion.mockResolvedValue({ data: { success: true } })
  tagsAPI.removeFromQuestion.mockResolvedValue({ data: { success: true } })
})

describe('QuestionTagEditor', () => {
  it('shows suggestions with their probability and applies one on click', async () => {
    questionsAPI.suggestTags.mockResolvedValue({
      data: { suggested: [{ ...loops, probability: 0.95 }, { ...python, probability: 0.72 }] },
    })
    const onChange = renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /suggest tags/i }))
    expect(await screen.findByText('95%')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Apply Loops' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([typing, { ...loops, probability: 0.95 }]))
    expect(tagsAPI.addToQuestion).toHaveBeenCalledWith(7, 2)
    expect(screen.queryByRole('button', { name: 'Apply Loops' })).not.toBeInTheDocument()
  })

  it('applies all suggestions in one change, keeping every tag', async () => {
    questionsAPI.suggestTags.mockResolvedValue({
      data: { suggested: [{ ...loops, probability: 0.95 }, { ...python, probability: 0.72 }] },
    })
    const onChange = renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /suggest tags/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Apply all' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    expect(onChange.mock.calls[0][0].map(tag => tag.id)).toEqual([3, 2, 1])
    expect(tagsAPI.addToQuestion).toHaveBeenCalledTimes(2)
  })

  it('dismisses a suggestion without saving anything', async () => {
    questionsAPI.suggestTags.mockResolvedValue({ data: { suggested: [{ ...loops, probability: 0.95 }] } })
    const onChange = renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /suggest tags/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss Loops' }))

    expect(tagsAPI.addToQuestion).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows the server reason when there is nothing to suggest', async () => {
    questionsAPI.suggestTags.mockResolvedValue({
      data: { suggested: [], reason: 'Tag suggestions need a TypeSafe API key.' },
    })
    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /suggest tags/i }))
    expect(await screen.findByText('Tag suggestions need a TypeSafe API key.')).toBeInTheDocument()
  })

  it('adds a tag by hand and removes one', async () => {
    const onChange = renderEditor()

    fireEvent.change(screen.getByLabelText('Add a tag'), { target: { value: '1' } })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([typing, python]))

    fireEvent.click(screen.getByRole('button', { name: 'Remove Typing' }))
    await waitFor(() => expect(tagsAPI.removeFromQuestion).toHaveBeenCalledWith(7, 3))
  })

  it('reports a failed save', async () => {
    tagsAPI.addToQuestion.mockRejectedValue({ message: 'Tag not found' })
    const onChange = renderEditor()

    fireEvent.change(screen.getByLabelText('Add a tag'), { target: { value: '1' } })

    expect(await screen.findByRole('alert')).toHaveTextContent('Tag not found')
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('QuestionTagEditor after the last suggestion is handled', () => {
  it('collapses instead of claiming no tag fits', async () => {
    questionsAPI.suggestTags.mockResolvedValue({ data: { suggested: [{ ...loops, probability: 0.95 }] } })
    tagsAPI.addToQuestion.mockResolvedValue({ data: { success: true } })
    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /suggest tags/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Apply Loops' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Apply Loops' })).not.toBeInTheDocument())
    expect(screen.queryByText('None of your tags fit this card.')).not.toBeInTheDocument()
  })
})
