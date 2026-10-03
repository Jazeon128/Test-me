import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import PracticeSession from '../PracticeSession'

vi.mock('../../services/api', () => ({ progressAPI: {
  getReviewSession: vi.fn().mockResolvedValue({ data: { questions: [{
    id: 1, question_text: 'Focus question', options: [{ option: 'A', text: 'Answer' }],
    source_reference: { section: 'Focus', passage: 'The source passage.' },
  }] } }),
} }))
afterEach(cleanup)

it('keeps hint 1 on the button and focuses the hint 2 block after the second press', async () => {
  render(<MemoryRouter><PracticeSession onExit={vi.fn()} onFinished={vi.fn()} onEmpty={vi.fn()} /></MemoryRouter>)
  const button = await screen.findByRole('button', { name: 'Hint' })
  button.focus()
  fireEvent.click(button)
  expect(screen.getByRole('button', { name: 'Show the passage' })).toHaveFocus()
  fireEvent.click(button)
  const block = screen.getByText('Hint 2 of 2:').parentElement
  expect(block).toHaveAttribute('tabindex', '-1')
  expect(block).toHaveFocus()
  expect(block).toHaveTextContent('The source passage.')
})
