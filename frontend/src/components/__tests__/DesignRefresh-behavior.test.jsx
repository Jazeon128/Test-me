import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import Notebooks from '../../pages/Notebooks'
import NotebookWorkspace from '../../pages/NotebookWorkspace'
import PracticeSession from '../PracticeSession'
import Layout from '../Layout'
import { notebooksAPI, progressAPI } from '../../services/api'
vi.mock('../../services/api', () => ({
  notebooksAPI: { list: vi.fn(), workspace: vi.fn(), chatHistory: vi.fn() },
  progressAPI: { getStatsByNotebook: vi.fn(), getStats: vi.fn(), getReviewSession: vi.fn() },
  statusAPI: { get: vi.fn() }, decksAPI: {}, canvasAPI: {}, documentsAPI: {},
}))
vi.mock('../ProgressOverview', () => ({ default: () => null }))
vi.mock('../SearchModal', () => ({ default: () => null }))
vi.mock('../../context/useTheme', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }))
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  notebooksAPI.list.mockResolvedValue({ data: [{ id: 7, name: 'Biology', sources: 0, decks: 0, canvases: 0 }] })
  progressAPI.getStatsByNotebook.mockResolvedValue({ data: [{ notebook_id: 7, questions_due: 3 }] })
  progressAPI.getStats.mockResolvedValue({ data: {} })
  progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [] } })
  notebooksAPI.workspace.mockResolvedValue({ data: { notebook: { id: 7, name: 'Biology' }, sources: [], jobs: [], artifacts: { decks: [], canvases: [] }, progress: {} } })
  notebooksAPI.chatHistory.mockResolvedValue({ data: [] })
})
afterEach(() => vi.restoreAllMocks())
function home() {
  return render(<MemoryRouter><Routes><Route path="/" element={<Notebooks />} /><Route path="/notebooks/:notebookId" element={<p>Notebook page</p>} /><Route path="/review" element={<p>Review page</p>} /></Routes></MemoryRouter>)
}
const save = (notebookId = 7) => localStorage.setItem('test-me.lastNotebook', JSON.stringify({ notebookId, name: 'Old name', openedAt: '2026-10-03T00:00:00Z' }))
it.each(['Open notebook', 'Review due'])('continues the saved notebook with its name and due count using %s', async button => {
  save()
  home()
  const card = await screen.findByRole('region', { name: 'Continue where you left off' })
  expect(within(card).getByText('Biology')).toBeInTheDocument()
  expect(await within(card).findByText('3 questions due')).toBeInTheDocument()
  expect(within(card).getAllByRole('button')).toHaveLength(2)
  fireEvent.click(within(card).getByRole('button', { name: button }))
  expect(await screen.findByText(button === 'Open notebook' ? 'Notebook page' : 'Review page')).toBeInTheDocument()
})
it('shows only Open notebook when nothing is due', async () => {
  save()
  progressAPI.getStatsByNotebook.mockResolvedValue({ data: [{ notebook_id: 7, questions_due: 0 }] })
  home()
  const card = await screen.findByRole('region', { name: 'Continue where you left off' })
  expect(within(card).getByText('Nothing due')).toBeInTheDocument()
  expect(within(card).getAllByRole('button')).toHaveLength(1)
  expect(within(card).getByRole('button', { name: 'Open notebook' })).toBeInTheDocument()
})
it('clears a deleted notebook without showing a continue card', async () => {
  save(99)
  home()
  await screen.findByRole('button', { name: /Biology/ })
  expect(localStorage.getItem('test-me.lastNotebook')).toBeNull()
  expect(screen.queryByRole('region', { name: 'Continue where you left off' })).not.toBeInTheDocument()
})
it('keeps home usable when localStorage throws', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied') })
  home()
  expect(await screen.findByRole('button', { name: /Biology/ })).toBeInTheDocument()
})
it('adds focus-mode while practice is mounted and removes it on unmount', async () => {
  const view = render(<MemoryRouter><PracticeSession embedded onExit={vi.fn()} onEmpty={vi.fn()} /></MemoryRouter>)
  expect(document.documentElement).toHaveClass('focus-mode')
  await screen.findByText('No questions available')
  view.unmount()
  expect(document.documentElement).not.toHaveClass('focus-mode')
})
it('stores a notebook when opening its workspace', async () => {
  render(<MemoryRouter initialEntries={['/notebooks/7']}><Routes><Route path="/notebooks/:notebookId" element={<NotebookWorkspace />} /></Routes></MemoryRouter>)
  await waitFor(() => expect(JSON.parse(localStorage.getItem('test-me.lastNotebook'))).toEqual({ notebookId: 7, name: 'Biology', openedAt: expect.any(String) }))
  expect(Number.isNaN(Date.parse(JSON.parse(localStorage.getItem('test-me.lastNotebook')).openedAt))).toBe(false)
})
it('renders the header icon as a decorative image', async () => {
  render(<MemoryRouter><Layout>Content</Layout></MemoryRouter>)
  const image = screen.getByRole('link', { name: 'Test Me home' }).querySelector('img')
  expect(image).toHaveAttribute('alt', '')
  expect(image).toHaveAttribute('width', '36')
  expect(image).toHaveAttribute('height', '36')
  expect(image.getAttribute('src')).toMatch(/icons\/icon-192.png$/)
  await waitFor(() => expect(progressAPI.getStats).toHaveBeenCalled())
})
