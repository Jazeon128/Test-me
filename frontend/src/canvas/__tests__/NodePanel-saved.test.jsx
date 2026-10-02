import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import NodePanel from '../NodePanel'
import { canvasAPI } from '../../services/api'

vi.mock('../../services/api', () => ({ canvasAPI: { savedQuestionsForNode: vi.fn(), questionsForNode: vi.fn() } }))
const question = { id: 10, question: 'Saved stem', options: [{ option: 'A', text: 'First option' }],
  correct_answer: 'A', explanation: 'Saved explanation' }
const result = { questions: [question], deck_id: 12, notebook_id: 7, held_back: 2 }
function mount() {
  return render(<MemoryRouter><NodePanel canvasId={3} node={{ id: 'node', data: { label: 'Topic' } }}
    source={{ section: { text: 'Original passage' } }} onClose={vi.fn()} /></MemoryRouter>)
}
beforeEach(() => { vi.resetAllMocks() })
it('loads saved questions, hides and toggles answers, and links to practice and review', async () => {
  canvasAPI.savedQuestionsForNode.mockResolvedValue({ data: result })
  mount()
  expect(await screen.findByText('Saved stem')).toBeInTheDocument()
  expect(screen.getByText('First option', { exact: false })).toBeInTheDocument()
  expect(screen.getByText('Original passage')).toBeInTheDocument()
  expect(canvasAPI.savedQuestionsForNode).toHaveBeenCalledWith(3, 'node')
  expect(canvasAPI.questionsForNode).not.toHaveBeenCalled()
  expect(screen.queryByText(/Saved explanation/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Show answer' }))
  expect(screen.getByText('Answer: A. Saved explanation')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Hide answer' }))
  expect(screen.queryByText(/Saved explanation/)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Practise canvas deck' })).toHaveAttribute('href', '/notebooks/7?deck=12&view=practice')
  expect(screen.getByRole('link', { name: 'Practise canvas deck' })).toHaveClass('btn-primary')
  expect(screen.getByText(/2 held back by the quality check/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/notebooks/7?deck=12&view=edit')
})
it('disables generation during GET and POST, generates once, then asks for 3 more', async () => {
  let resolveGet, resolvePost
  canvasAPI.savedQuestionsForNode.mockReturnValue(new Promise(resolve => { resolveGet = resolve }))
  canvasAPI.questionsForNode.mockImplementation(() => new Promise(resolve => { resolvePost = resolve }))
  mount()
  expect(screen.getByRole('button', { name: 'Generating...' })).toBeDisabled()
  resolveGet({ data: { questions: [], held_back: 0, deck_id: null } })
  const generate = await screen.findByRole('button', { name: 'Test me on this' })
  fireEvent.click(generate)
  expect(screen.getByRole('button', { name: 'Generating...' })).toBeDisabled()
  expect(canvasAPI.questionsForNode).toHaveBeenCalledWith(3, 'node')
  resolvePost({ data: result })
  fireEvent.click(await screen.findByRole('button', { name: 'Make 3 more' }))
  expect(screen.getByRole('button', { name: 'Generating...' })).toBeDisabled()
  expect(canvasAPI.questionsForNode).toHaveBeenLastCalledWith(3, 'node', 3, true)
  resolvePost({ data: { ...result, questions: [question, { ...question, id: 11, question: 'Second stem' }] } })
  expect(await screen.findByText('Second stem')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Make 3 more' })).toBeEnabled())
})
it('shows load errors inline and restores the button', async () => {
  canvasAPI.savedQuestionsForNode.mockRejectedValue(new Error('Unavailable'))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load questions for this node.')
  expect(screen.getByRole('button', { name: 'Test me on this' })).toBeEnabled()
})
