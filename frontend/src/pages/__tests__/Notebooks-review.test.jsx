import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import Notebooks from '../Notebooks'
import { notebooksAPI, progressAPI } from '../../services/api'

vi.mock('../../services/api', () => ({ notebooksAPI: { list: vi.fn() }, progressAPI: { getStatsByNotebook: vi.fn() } }))
vi.mock('../../components/ProgressOverview', () => ({ default: ({ notebookStats }) => <p>Progress overview: {notebookStats.length} notebooks</p> }))
beforeEach(() => {
  vi.resetAllMocks()
  notebooksAPI.list.mockResolvedValue({ data: [{ id: 1, name: 'Biology', sources: 1, decks: 1, canvases: 0 }] })
})
afterEach(() => vi.restoreAllMocks())
function mount(path = '/') {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/" element={<Notebooks />} /><Route path="/review" element={<p>Review page</p>} />
  </Routes></MemoryRouter>)
}
it('hides Review due at 0 and retains the progress section', async () => {
  progressAPI.getStatsByNotebook.mockResolvedValue({ data: [] })
  mount()
  await screen.findByText('Biology')
  expect(screen.queryByRole('region', { name: 'Review due' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Progress' })).toHaveAttribute('id', 'progress')
  expect(screen.getByText('Progress overview: 0 notebooks')).toBeInTheDocument()
})
it('totals due questions across notebooks and opens review above the grid', async () => {
  progressAPI.getStatsByNotebook.mockResolvedValue({ data: [{ notebook_id: 1, questions_due: 3 }, { notebook_id: 2, questions_due: 4 }] })
  mount()
  await screen.findByText('7 questions due')
  const card = screen.getByRole('region', { name: 'Review due' })
  expect(card.compareDocumentPosition(screen.getByText('Biology')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Review due' }))
  expect(await screen.findByText('Review page')).toBeInTheDocument()
})
it('scrolls the progress hash to the progress section after loading', async () => {
  const scroll = vi.fn()
  const previous = Element.prototype.scrollIntoView
  Element.prototype.scrollIntoView = scroll
  try {
    progressAPI.getStatsByNotebook.mockResolvedValue({ data: [] })
    mount('/#progress')
    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1))
    expect(scroll.mock.instances[0]).toBe(screen.getByRole('region', { name: 'Progress' }))
  } finally { Element.prototype.scrollIntoView = previous }
})
