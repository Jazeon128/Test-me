import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import App from '../../App'
import { decksAPI } from '../../services/api'

vi.mock('../../services/api', () => ({ decksAPI: { get: vi.fn() } }))
vi.mock('../../components/Layout', () => ({ default: ({ children }) => <>{children}</> }))
vi.mock('../../components/UpdateNotification', () => ({ default: () => null }))
vi.mock('../../pages/Notebooks', () => ({ default: () => <p>Notebook home</p> }))
vi.mock('../../pages/NotebookWorkspace', () => ({ default: () => <p>Notebook workspace</p> }))
vi.mock('../../pages/Settings', () => ({ default: () => <p>Settings page</p> }))
vi.mock('../../pages/Review', () => ({ default: () => <p>Review page</p> }))
function Location() {
  const location = useLocation()
  const navigate = useNavigate()
  return <><output aria-label="Location">{location.pathname}{location.search}{location.hash}</output>
    <button onClick={() => navigate(-1)}>Back</button></>
}
function mount(path) {
  render(<MemoryRouter initialEntries={['/settings', path]}><Location /><App /></MemoryRouter>)
}
beforeEach(() => {
  vi.resetAllMocks()
  localStorage.setItem('test-me.welcomeCompleted', 'true')
})
it.each([
  ['/decks', '/'], ['/upload', '/'], ['/upload?notebook=9', '/notebooks/9'],
  ['/progress', '/#progress'], ['/practice', '/review'],
])('redirects %s to %s and replaces the old entry', async (from, to) => {
  mount(from)
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent(new RegExp(`^${to}$`)))
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.getByLabelText('Location')).toHaveTextContent('/settings')
})
it.each([['/decks/4', 'edit'], ['/decks/4/practice', 'practice']])('looks up %s and opens %s', async (from, view) => {
  let resolve
  decksAPI.get.mockReturnValue(new Promise(done => { resolve = done }))
  mount(from)
  expect(await screen.findByLabelText('Loading deck')).toBeInTheDocument()
  resolve({ data: { id: 4, notebook_id: 9 } })
  await waitFor(() => expect(screen.getByLabelText('Location')).toHaveTextContent(`/notebooks/9?deck=4&view=${view}`))
  expect(decksAPI.get).toHaveBeenCalledWith('4')
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.getByLabelText('Location')).toHaveTextContent('/settings')
})
it.each(['/decks/404', '/decks/404/practice'])('shows a missing deck for %s', async path => {
  decksAPI.get.mockRejectedValue({ originalError: { response: { status: 404 } } })
  mount(path)
  expect(await screen.findByRole('alert')).toHaveTextContent('That deck no longer exists')
  expect(screen.getByRole('link', { name: 'Back to notebooks' })).toHaveAttribute('href', '/')
})
