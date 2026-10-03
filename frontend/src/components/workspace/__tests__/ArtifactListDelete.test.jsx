import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import ArtifactList from '../ArtifactList'

function mount(onDeleteCanvas) {
  render(<MemoryRouter><ArtifactList notebookId="7" progress={{}} onDeleteCanvas={onDeleteCanvas}
    artifacts={{ decks: [], canvases: [{ id: 4, title: 'Connections' }, { id: 5, title: 'Other' }] }} /></MemoryRouter>)
}

it('confirms inline, focuses Cancel, and cancels without deleting', () => {
  const remove = vi.fn()
  mount(remove)
  fireEvent.click(screen.getByRole('button', { name: 'Delete canvas Connections' }))
  expect(screen.getByText('Delete this canvas? Its quiz deck stays.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByText('Delete this canvas? Its quiz deck stays.')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open Connections' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete canvas Connections' })).toBeInTheDocument()
  expect(remove).not.toHaveBeenCalled()
})

it('deletes with the canvas id and shows a rejected server message in its row', async () => {
  const remove = vi.fn().mockRejectedValue({ response: { data: { detail: 'Demo canvases cannot be deleted.' } } })
  mount(remove)
  fireEvent.click(screen.getByRole('button', { name: 'Delete canvas Connections' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete canvas', exact: true }))
  await waitFor(() => expect(remove).toHaveBeenCalledWith(4))
  expect(await screen.findByRole('alert')).toHaveTextContent('Demo canvases cannot be deleted.')
  expect(screen.getByRole('alert').closest('li')).toContainElement(screen.getByRole('link', { name: 'Open Connections' }))
})

it('keeps only one confirmation open', () => {
  mount(vi.fn())
  fireEvent.click(screen.getByRole('button', { name: 'Delete canvas Connections' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete canvas Other' }))
  expect(screen.getAllByText('Delete this canvas? Its quiz deck stays.')).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Delete canvas Connections' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
})
