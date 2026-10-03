import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import MasteryBar from '../MasteryBar'
import { notebooksAPI } from '../../../services/api'

vi.mock('../../../services/api', () => ({ notebooksAPI: { mastery: vi.fn() } }))
const data = {
  topics: [{ key: '3:Key Features', document_name: 'Cells', section: 'Key Features',
    question_count: 5, attempted_count: 4, level: 'proficient', question_ids: [11, 12, 13, 14, 15] }],
  summary: { topic_count: 6, proficient_or_above: 3,
    levels: { mastered: 2, proficient: 1, familiar: 2, attempted: 1, not_started: 0 } },
}
beforeEach(() => { vi.resetAllMocks(); notebooksAPI.mastery.mockResolvedValue({ data }) })

it('shows the summary and accessible counts in segment order', async () => {
  render(<MasteryBar notebookId="7" practise={vi.fn()} />)
  expect(await screen.findByText('Mastery: 3 of 6 topics Proficient or above')).toBeInTheDocument()
  const bar = screen.getByRole('img', { name: '2 mastered, 1 proficient, 2 familiar, 1 attempted, 0 not started' })
  expect(bar.children[0]).toHaveStyle({ width: `${2 / 6 * 100}%`, background: 'var(--mastery-mastered)' })
  expect(notebooksAPI.mastery).toHaveBeenCalledWith('7')
})

it('renders nothing for zero topics', async () => {
  notebooksAPI.mastery.mockResolvedValue({ data: { topics: [], summary: { topic_count: 0 } } })
  const { container } = render(<MasteryBar notebookId="7" practise={vi.fn()} />)
  await waitFor(() => expect(notebooksAPI.mastery).toHaveBeenCalled())
  expect(container).toBeEmptyDOMElement()
})

it('toggles topics and calls the shared selection-practice callback with topic ids', async () => {
  const practise = vi.fn()
  render(<MasteryBar notebookId="7" practise={practise} />)
  const disclosure = await screen.findByRole('button', { name: 'Show topics' })
  expect(disclosure).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('Key Features')).not.toBeInTheDocument()
  fireEvent.click(disclosure)
  expect(disclosure).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('Cells')).toBeInTheDocument()
  expect(screen.getByText('4 of 5 tried')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Practise' }))
  expect(practise).toHaveBeenCalledWith([11, 12, 13, 14, 15])
  fireEvent.click(disclosure)
  expect(screen.queryByText('Key Features')).not.toBeInTheDocument()
})

it('refetches when the workspace refresh signal changes', async () => {
  const { rerender } = render(<MasteryBar notebookId="7" refreshSignal={1} practise={vi.fn()} />)
  await screen.findByRole('img')
  rerender(<MasteryBar notebookId="7" refreshSignal={2} practise={vi.fn()} />)
  await waitFor(() => expect(notebooksAPI.mastery).toHaveBeenCalledTimes(2))
})
