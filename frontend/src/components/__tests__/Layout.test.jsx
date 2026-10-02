import { act, render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import Layout from '../Layout'
import { progressAPI } from '../../services/api'

vi.mock('../../services/api', () => ({ progressAPI: { getStats: vi.fn() } }))
beforeEach(() => {
  vi.resetAllMocks()
  progressAPI.getStats.mockResolvedValue({ data: { questions_due: 0 } })
})

vi.mock('../../context/useTheme', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }))
vi.mock('../SearchModal', () => ({ default: ({ isOpen }) => isOpen ? <p>Search open</p> : null }))
it('keeps Notebooks, Settings and Search in desktop and mobile navigation', async () => {
  render(<MemoryRouter><Layout><p>Content</p></Layout></MemoryRouter>)
  expect(screen.getByRole('link', { name: 'Notebooks' })).toHaveAttribute('href', '/')
  expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
  for (const name of ['Decks', 'Progress', 'Add material']) expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(screen.getByText('Search open')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
  const mobile = document.getElementById('mobile-navigation')
  expect(within(mobile).getAllByRole('link')).toHaveLength(3)
  expect(within(mobile).getByRole('link', { name: 'Notebooks' })).toHaveAttribute('href', '/')
  expect(within(mobile).getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/review')
  expect(within(mobile).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
  await act(async () => {})
})

it('shows the active Review link and due count in both menus, fetching once', async () => {
  progressAPI.getStats.mockResolvedValue({ data: { questions_due: 3 } })
  const rendered = render(<MemoryRouter initialEntries={['/review']}><Layout>Content</Layout></MemoryRouter>)
  const review = await screen.findByRole('link', { name: 'Review, 3 due' })
  expect(review).toHaveAttribute('href', '/review')
  expect(review).toHaveAttribute('aria-current', 'page')
  expect(review).toHaveClass('is-active')
  expect(review).toHaveTextContent('3')
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
  expect(within(document.getElementById('mobile-navigation')).getByRole('link', { name: 'Review, 3 due' })).toHaveAttribute('aria-current', 'page')
  rendered.rerender(<MemoryRouter initialEntries={['/review']}><Layout>Updated</Layout></MemoryRouter>)
  expect(progressAPI.getStats).toHaveBeenCalledTimes(1)
})
it.each(['zero', 'failure'])('keeps Review without a badge on %s', async outcome => {
  if (outcome === 'failure') progressAPI.getStats.mockRejectedValue(new Error('Offline'))
  render(<MemoryRouter><Layout>Content</Layout></MemoryRouter>)
  await act(async () => {})
  const review = screen.getByRole('link', { name: 'Review' })
  expect(review.querySelector('.nav-due-badge')).toBeNull()
  expect(review).not.toHaveAttribute('aria-current')
})
