import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import SourcesPanel from '../SourcesPanel'
import { notebooksAPI } from '../../../services/api'

vi.mock('../../../services/api', () => ({ notebooksAPI: { addSources: vi.fn() } }))
beforeEach(() => vi.resetAllMocks())
function mount() {
  render(<SourcesPanel notebookId="7" sources={[]} selected={{}} setSelected={vi.fn()} refresh={vi.fn()} />)
}
it.each(['button', 'Escape'])('closes with %s, resets fields and returns focus', method => {
  mount()
  const button = screen.getByRole('button', { name: 'Add source' })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(button)
  expect(button).toHaveAccessibleName('Cancel')
  expect(button).toHaveAttribute('aria-expanded', 'true')
  expect(button.querySelector('svg')).toBeInTheDocument()
  const input = screen.getByLabelText('YouTube URL')
  expect(input.closest('form').id).toBe(button.getAttribute('aria-controls'))
  fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=123' } })
  fireEvent.change(screen.getByLabelText('Files'), { target: { files: [new File(['notes'], 'notes.md')] } })
  input.focus()
  if (method === 'Escape') fireEvent.keyDown(input, { key: 'Escape' })
  else fireEvent.click(button)
  expect(screen.queryByLabelText('YouTube URL')).not.toBeInTheDocument()
  expect(button).toHaveFocus()
  expect(button).toHaveAccessibleName('Add source')
  expect(button).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(button)
  expect(screen.getByLabelText('YouTube URL')).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Add sources' })).toBeDisabled()
})
it('closes after a successful add', async () => {
  notebooksAPI.addSources.mockResolvedValue({ data: { sources: [] } })
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Add source' }))
  fireEvent.change(screen.getByLabelText('Files'), { target: { files: [new File(['notes'], 'notes.md')] } })
  fireEvent.click(screen.getByRole('button', { name: 'Add sources' }))
  await waitFor(() => expect(screen.queryByLabelText('Files')).not.toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Add source' })).toHaveFocus()
})
