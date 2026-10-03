import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import DemoTour from '../DemoTour'
import { startTour, tourSteps, waitForAnchor } from '../tour'

vi.mock('../../services/api', () => ({ progressAPI: { getStats: async () => ({ data: {} }) } }))
vi.mock('../../context/useTheme', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }))
vi.mock('../../components/SearchModal', () => ({ default: () => null }))

let stop
beforeEach(() => {
  localStorage.clear()
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: query.includes('reduced-motion'), addEventListener() {}, removeEventListener() {},
  }))
})
afterEach(() => {
  stop?.()
  stop = null
  cleanup()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it.each(['true', 'false'])('shows the banner tour button only when demo=%s', async demo => {
  vi.stubEnv('VITE_DEMO', demo)
  vi.resetModules()
  const { default: Layout } = await import('../../components/Layout')
  render(<MemoryRouter><Layout>Content</Layout></MemoryRouter>)
  if (demo === 'true') expect(await screen.findByRole('button', { name: 'Take the tour' })).toBeInTheDocument()
  else expect(screen.queryByRole('button', { name: 'Take the tour' })).not.toBeInTheDocument()
})

it('offers the tour once and remembers Not now across mounts', () => {
  const mount = () => render(<MemoryRouter initialEntries={['/notebooks/1']}><DemoTour /></MemoryRouter>)
  const view = mount()
  expect(screen.getByText('New here? Take a 2-minute tour of Test Me.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
  expect(localStorage.getItem('test-me.tourSeen')).toBe('true')
  view.unmount()
  mount()
  expect(screen.queryByRole('button', { name: 'Start tour' })).not.toBeInTheDocument()
})

it('starting from the card remembers the choice and restores focus to the banner on Esc', async () => {
  render(<MemoryRouter initialEntries={['/notebooks/1']}><DemoTour /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Start tour' }))
  expect(localStorage.getItem('test-me.tourSeen')).toBe('true')
  await screen.findByRole('dialog')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Take the tour' })).toHaveFocus()
})

it('has all 11 steps in the prescribed order and routes', () => {
  expect(tourSteps.map(([route, anchor, title]) => [route, anchor, title])).toEqual([
    ['/notebooks/1', null, 'Welcome to Test Me'],
    ['/notebooks/1', 'sources', 'Your sources'],
    ['/notebooks/1', 'mastery', 'Mastery by topic'],
    ['/notebooks/1', 'chat', 'Grounded chat'],
    ['/notebooks/1', 'chat-mode', 'Tutor me'],
    ['/notebooks/1', 'studio', 'Studio'],
    ['/notebooks/1', 'questions', 'Question bank'],
    ['/canvas/3', 'canvas', 'Canvas'],
    ['/notebooks/1', 'hint', 'Practice with hints'],
    ['/review', 'review', 'Review'],
    ['/review', 'get-test-me', 'Get Test Me'],
  ])
})

it('polls for 5 seconds and shows a missing anchor centred', async () => {
  vi.useFakeTimers()
  const missing = waitForAnchor('missing')
  await vi.advanceTimersByTimeAsync(4999)
  await vi.advanceTimersByTimeAsync(1)
  expect(await missing).toBeUndefined()
  stop = startTour(vi.fn(), null)
  await vi.advanceTimersByTimeAsync(0)
  fireEvent.keyDown(document, { key: 'ArrowRight' })
  await vi.advanceTimersByTimeAsync(5000)
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveClass('driver-popover-side-over')
  expect(dialog).toHaveTextContent('Your sources')
  expect(dialog).toHaveTextContent('2 of 11')
})

it('Esc closes the real driver popover and restores focus to its trigger', async () => {
  render(<button>Take the tour</button>)
  const trigger = screen.getByRole('button')
  trigger.focus()
  stop = startTour(vi.fn(), trigger)
  await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('Welcome to Test Me'))
  expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
  expect(localStorage.getItem('test-me.tourSeen')).toBe('true')
})

it('Next and Back navigate across routes and narrow screens use topbar anchors', async () => {
  vi.useFakeTimers()
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390)
  const ids = ['sources-button', 'mastery', 'chat', 'chat-mode', 'studio-button', 'questions', 'canvas', 'review', 'get-test-me']
  render(<>{ids.map(id => <button key={id} data-tour={id}>{id}</button>)}</>)
  const navigate = vi.fn()
  stop = startTour(navigate, null)
  await vi.advanceTimersByTimeAsync(0)
  for (let i = 1; i <= 7; i++) {
    fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }))
    await vi.advanceTimersByTimeAsync(0)
    expect(screen.getByRole('dialog')).toHaveTextContent(`${i + 1} of 11`)
  }
  expect(navigate).toHaveBeenLastCalledWith('/canvas/3')
  fireEvent.click(screen.getByRole('button', { name: 'Back', exact: true }))
  await vi.advanceTimersByTimeAsync(0)
  expect(navigate).toHaveBeenLastCalledWith('/notebooks/1')
  expect(screen.getByRole('dialog')).toHaveTextContent('Question bank')
})
