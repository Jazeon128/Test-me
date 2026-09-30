import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import api from '../../services/api'
import TypeSafeKeyCard from '../TypeSafeKeyCard'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const endpoint = '/settings/typesafe'
const usageUrl = `${endpoint}/usage?days=30`
const empty = { days: 30, features: [], totals: { calls: 0, failures: 0, input_tokens: 0 } }
const usage = {
  days: 30,
  features: [
    { label: 'settings_test', calls: 3, failures: 1, input_tokens: 1200, avg_duration_ms: 100 },
    { label: 'review_explanation', calls: 2, failures: 0, input_tokens: 40, avg_duration_ms: 200 },
  ],
  totals: { calls: 5, failures: 1, input_tokens: 1240 },
}

function mockUsage(data) {
  api.get.mockImplementation((url) => url === usageUrl
    ? Promise.resolve({ data })
    : Promise.resolve({ data: { configured: true, source: 'settings', preview: 'saved' } }))
}

beforeEach(() => {
  vi.resetAllMocks()
  mockUsage(empty)
})

it('renders feature rows and totals in a scrollable table', async () => {
  mockUsage(usage)
  render(<TypeSafeKeyCard />)
  const table = await screen.findByRole('table')
  expect(screen.getByText('Usage, last 30 days')).toBeInTheDocument()
  expect(table.parentElement).toHaveClass('overflow-x-auto')
  expect(within(table).getAllByRole('columnheader').map((node) => node.textContent)).toEqual([
    'Feature', 'Calls', 'Failed', 'Input tokens',
  ])
  const rows = within(table).getAllByRole('row')
  expect(rows.map((row) => within(row).queryAllByRole('cell').map((cell) => cell.textContent))).toEqual([
    [], ['3', '1', (1200).toLocaleString()], ['2', '0', '40'], ['5', '1', (1240).toLocaleString()],
  ])
  expect(within(table).getByText('settings_test')).toBeInTheDocument()
  expect(within(table).getByText('review_explanation')).toBeInTheDocument()
  expect(within(table).getByText('Total')).toBeInTheDocument()
  within(table).getAllByRole('cell').forEach((cell) => expect(cell).toHaveClass('text-right', 'tabular-nums'))
})

it('shows the empty state', async () => {
  render(<TypeSafeKeyCard />)
  expect(await screen.findByText('No Jev calls yet.')).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

it('keeps the card working when usage fails', async () => {
  api.get.mockImplementation((url) => url === usageUrl
    ? Promise.reject(new Error('Offline'))
    : Promise.resolve({ data: { configured: true, source: 'settings', preview: 'saved' } }))
  api.post.mockResolvedValue({ data: { success: true, message: 'Connected.' } })
  render(<TypeSafeKeyCard />)
  fireEvent.click(await screen.findByRole('button', { name: 'Test TypeSafe key' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Connected.')
  expect(screen.queryByText('Usage, last 30 days')).not.toBeInTheDocument()
  expect(screen.getByLabelText('TypeSafe API key')).toBeEnabled()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Test TypeSafe key' })).toBeEnabled())
})

it('reloads usage after a successful key test', async () => {
  api.post.mockResolvedValue({ data: { success: true, message: 'Connected.' } })
  render(<TypeSafeKeyCard />)
  await screen.findByText('No Jev calls yet.')
  mockUsage(usage)
  fireEvent.click(screen.getByRole('button', { name: 'Test TypeSafe key' }))
  expect(await screen.findByRole('table')).toBeInTheDocument()
  expect(api.get.mock.calls.filter(([url]) => url === usageUrl)).toHaveLength(2)
})
