import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import StudioPanel from '../StudioPanel'
import { notebooksAPI } from '../../../services/api'

vi.mock('../../../services/api', () => ({ notebooksAPI: { generate: vi.fn() } }))
const rejected = { status: 409, originalError: { response: { status: 409, data: { unteachable: [
  { id: 9, display_name: 'vlog.md', is_teachable: 0.08, is_transcript: 0.91 },
] } } } }
let onJob
beforeEach(() => { vi.resetAllMocks(); onJob = vi.fn() })
function mount() {
  render(<StudioPanel notebookId="7" sourceIds={[9]} jobs={[]} artifacts={{ decks: [], canvases: [] }}
    progress={{}} refresh={vi.fn()} onJob={onJob} open={vi.fn()} onCanvas={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Quiz' }))
  fireEvent.click(screen.getByRole('button', { name: 'Generate', exact: true }))
}
it('holds generation and explains the rejected source', async () => {
  notebooksAPI.generate.mockRejectedValue(rejected)
  mount()
  expect(await screen.findByText(/8% teachable/)).toBeInTheDocument()
  expect(screen.getByText(/reads like a transcript/)).toBeInTheDocument()
  expect(onJob).not.toHaveBeenCalled()
})
it('generates from the stored upload when confirmed', async () => {
  notebooksAPI.generate.mockRejectedValueOnce(rejected).mockResolvedValueOnce({ data: { job_id: 'job-1' } })
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Generate anyway' }))
  await waitFor(() => expect(onJob).toHaveBeenCalledWith(expect.objectContaining({ job_id: 'job-1' })))
  expect(notebooksAPI.generate.mock.calls[1]).toEqual(['7', { ...notebooksAPI.generate.mock.calls[0][1], allow_unteachable: true }])
  expect(notebooksAPI.generate.mock.calls[1][1].source_ids).toEqual([9])
  expect(screen.queryByText(/8% teachable/)).not.toBeInTheDocument()
})
it('cancels without generating', async () => {
  notebooksAPI.generate.mockRejectedValue(rejected)
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel generation' }))
  expect(screen.queryByText(/8% teachable/)).not.toBeInTheDocument()
  expect(notebooksAPI.generate).toHaveBeenCalledTimes(1)
  expect(onJob).not.toHaveBeenCalled()
})


it.each([
  ['study_process', 'Looks like notes about your study process, not study material', false],
  ['low_teachability', 'Little to study', false],
  ['empty', 'No text could be read from this source', true],
])('explains %s and controls override', async (reason, message, disabled) => {
  notebooksAPI.generate.mockRejectedValue({ status: 409, response: { data: { unteachable: [
    { id: 9, display_name: 'notes.md', reason, has_study_content: .1, is_teachable: .99 },
  ] } } })
  mount()
  expect(await screen.findByText(`notes.md: ${message}`)).toBeInTheDocument()
  const override = screen.getByRole('button', { name: 'Generate anyway' })
  if (disabled) {
    expect(override).toBeDisabled()
    fireEvent.click(override)
    expect(notebooksAPI.generate).toHaveBeenCalledTimes(1)
  } else expect(override).toBeEnabled()
})
