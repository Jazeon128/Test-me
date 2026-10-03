import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import NotebookWorkspace from '../NotebookWorkspace'
import { notebooksAPI } from '../../services/api'

vi.mock('../../services/api', () => ({ notebooksAPI: { mastery: vi.fn(), workspace: vi.fn() } }))
vi.mock('../../components/workspace/SourcesPanel', () => ({ default: () => null }))
vi.mock('../../components/workspace/StudioPanel', () => ({ default: () => null }))
vi.mock('../../components/workspace/ChatPanel', () => ({ default: () => null }))
vi.mock('../../components/bank/QuestionBank', () => ({ default: () => <p>Question bank</p> }))
vi.mock('../../components/PracticeSession', () => ({ default: ({ questionIds, onFinished }) =>
  <><p>Selection ids: {questionIds.join(',')}</p><button onClick={onFinished}>Finish session</button></> }))

function Location() {
  return <output aria-label="Location">{useLocation().search}</output>
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  notebooksAPI.workspace.mockImplementation(async () => ({ data: {
    notebook: { id: 7, name: 'Biology' }, sources: [], artifacts: { decks: [], canvases: [] },
    jobs: [], progress: { question_count: 5 },
  } }))
  notebooksAPI.mastery.mockResolvedValue({ data: {
    topics: [{ key: '3:Cells', section: 'Cells', document_name: 'Biology notes', level: 'familiar',
      question_count: 5, attempted_count: 3, question_ids: [11, 12, 13, 14, 15] }],
    summary: { topic_count: 1, proficient_or_above: 0,
      levels: { mastered: 0, proficient: 0, familiar: 1, attempted: 0, not_started: 0 } },
  } })
})

it('opens topic selection practice through the workspace path and refetches after finishing', async () => {
  render(<MemoryRouter initialEntries={['/notebooks/7']}><Location /><Routes>
    <Route path="/notebooks/:notebookId" element={<NotebookWorkspace />} />
  </Routes></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Show topics' }))
  fireEvent.click(screen.getByRole('button', { name: 'Practise' }))
  expect(screen.getByLabelText('Location')).toHaveTextContent('?view=practice-selection')
  expect(screen.getByText('Selection ids: 11,12,13,14,15')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Finish session' }))
  await waitFor(() => expect(notebooksAPI.mastery).toHaveBeenCalledTimes(2))
  expect(notebooksAPI.workspace).toHaveBeenCalledTimes(2)
  expect(screen.getByLabelText('Location')).toHaveTextContent('?view=questions')
})
