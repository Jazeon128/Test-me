import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import MasteryBar from '../MasteryBar'
import { notebooksAPI } from '../../../services/api'

vi.mock('../../../services/api', () => ({ notebooksAPI: { mastery: vi.fn() } }))
afterEach(cleanup)
it.each([true, false])('groups the document name only when every topic shares a document: %s', async shared => {
  notebooksAPI.mastery.mockResolvedValue({ data: {
    topics: [1, 2].map(id => ({ key: String(id), document_id: shared ? 1 : id,
      document_name: shared || id === 1 ? 'Cells' : 'Plants', section: `Section ${id}`,
      question_count: 4, attempted_count: 4, level: 'proficient', question_ids: [id] })),
    summary: { topic_count: 2, proficient_or_above: 2,
      levels: { mastered: 0, proficient: 2, familiar: 0, attempted: 0, not_started: 0 } },
  } })
  render(<MasteryBar notebookId="7" practise={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Show topics' }))
  const hide = screen.getByRole('button', { name: 'Hide topics' })
  expect(screen.getAllByText('Cells')).toHaveLength(1)
  expect(Boolean(screen.getByText('Cells').closest('li'))).toBe(!shared)
  expect(screen.getByText(/Answers found with a hint count as not yet right/)).toBeInTheDocument()
  fireEvent.click(hide)
  expect(screen.getByRole('button', { name: 'Show topics' })).toBeInTheDocument()
})
