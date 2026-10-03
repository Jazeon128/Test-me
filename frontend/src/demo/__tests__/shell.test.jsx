import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import fixture from './fixture.sample.json'

vi.mock('../../services/api', () => ({
  progressAPI: { getStats: vi.fn().mockResolvedValue({ data: { questions_due: 0 } }) },
  notebooksAPI: {
    list: vi.fn().mockResolvedValue({ data: fixture.routes['GET /notebooks/'] }),
    chatHistory: vi.fn().mockResolvedValue({ data: fixture.routes['GET /notebooks/1/chat'] }),
    chat: vi.fn().mockResolvedValue({ data: { ...fixture.routes['GET /notebooks/1/chat'][1], id: 3 } }),
  },
}))
vi.mock('../../components/SearchModal', () => ({ default: () => null }))
vi.mock('../../components/WelcomeScreen', () => ({ default: () => <p>Welcome form</p> }))
vi.mock('../../components/UpdateNotification', () => ({ default: () => null }))
vi.mock('../../pages/Notebooks', () => ({ default: () => <p>Notebook list</p> }))
vi.mock('../../pages/Review', () => ({ default: () => null }))
vi.mock('../../components/RedirectDeck', () => ({ default: () => null }))
vi.mock('../../pages/NotebookWorkspace', () => ({ default: () => <p>Notebook workspace</p> }))
vi.mock('../../pages/Settings', () => ({ default: () => <p>Provider key form</p> }))

afterEach(() => { cleanup(); vi.unstubAllEnvs() })
function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

it('shows the banner, hides Settings, skips welcome, and redirects home to the notebook', async () => {
  vi.stubEnv('VITE_DEMO', 'true')
  const { default: App } = await import('../../App')
  render(<MemoryRouter initialEntries={['/']}><App /><Location /></MemoryRouter>)
  expect(await screen.findByText('Notebook workspace')).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('/notebooks/1')
  expect(screen.getByText('Demo notebook: the learning pyramid. Nothing you do here is saved.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Get Test Me' })).toHaveAttribute('target', '_blank')
  expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
  expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
  expect(screen.queryByText('Welcome form')).not.toBeInTheDocument()
})

it('guards settings and keeps the notebook list accessible', async () => {
  vi.stubEnv('VITE_DEMO', 'true')
  const { default: App } = await import('../../App')
  const view = render(<MemoryRouter initialEntries={['/settings']}><App /></MemoryRouter>)
  expect(await screen.findByText(/This is a read-only demo/)).toBeInTheDocument()
  expect(screen.queryByText('Provider key form')).not.toBeInTheDocument()
  view.unmount()
  render(<MemoryRouter initialEntries={['/notebooks']}><App /></MemoryRouter>)
  expect(await screen.findByText('Notebook list')).toBeInTheDocument()
})

it('shows recorded question chips and replays the chosen question', async () => {
  vi.stubEnv('VITE_DEMO', 'true')
  const { default: ChatPanel } = await import('../../components/workspace/ChatPanel')
  const { notebooksAPI } = await import('../../services/api')
  render(<ChatPanel notebookId="1" sourceIds={[1]} sources={[{ id: 1, status: 'ready', display_name: 'Learning notes' }]} />)
  fireEvent.click(await screen.findByRole('button', { name: 'What is active recall?' }))
  expect(screen.getByRole('textbox')).toHaveValue('What is active recall?')
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''))
  expect(notebooksAPI.chat).toHaveBeenCalledWith('1', { message: 'What is active recall?', source_ids: [1], style: 'answer' })
})
