import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import SourcesPanel from '../SourcesPanel'
import { notebooksAPI } from '../../../services/api'

vi.mock('../../../services/api', () => ({ notebooksAPI: { addSources: vi.fn() } }))
it('says when a source could not be checked', () => {
  render(<SourcesPanel notebookId="7" sources={[{ id: 9, display_name: 'vlog.md', status: 'ready', preflight: { checked: false } }]}
    selected={{}} setSelected={vi.fn()} refresh={vi.fn()} />)
  expect(screen.getByText(/Could not check vlog.md before generating/)).toBeInTheDocument()
})
it('shows the server reason when the upload fails', async () => {
  notebooksAPI.addSources.mockRejectedValue({ message: 'File type not allowed' })
  const { container } = render(<SourcesPanel notebookId="7" sources={[]} selected={{}} setSelected={vi.fn()} refresh={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Add source' }))
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['text'], 'source.md')] } })
  fireEvent.click(screen.getByRole('button', { name: 'Add sources' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('File type not allowed')
  await waitFor(() => expect(notebooksAPI.addSources).toHaveBeenCalledTimes(1))
})


it.each([
  ['study_process', 'Looks like notes about your study process, not study material'],
  ['low_teachability', 'Little to study'],
  ['empty', 'No text could be read from this source'],
])('explains %s', (reason, message) => {
  render(<SourcesPanel notebookId="7" sources={[{ id: 9, display_name: 'notes.md', status: 'ready',
    preflight: { worth_generating: false, reason } }]} selected={{}} setSelected={vi.fn()} refresh={vi.fn()} />)
  expect(screen.getByText(message)).toBeInTheDocument()
})
