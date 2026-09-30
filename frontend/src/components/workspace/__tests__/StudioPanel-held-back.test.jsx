import { act, render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import StudioPanel from '../StudioPanel'

const warnings = ['Generated 1 of 4 question(s). Gemini failed on 3 section(s): 503 UNAVAILABLE', 'Some source sections could not be processed.']
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
function mount(count, notebook, messages) {
  const open = vi.fn()
  render(<StudioPanel notebookId={notebook ? '9' : '1'} sourceIds={[]} jobs={[{ job_id: 'held-job', deck_id: 4,
    status: 'completed', total_questions_flagged: count, warnings: messages }]}
    artifacts={{ decks: [], canvases: [] }} progress={{}} refresh={vi.fn()} onJob={vi.fn()} open={open} onCanvas={vi.fn()} />)
  return open
}
it.each([false, true])('keeps warnings until Continue, notebook=%s', async notebook => {
  const open = mount(0, notebook, warnings)
  await act(async () => { vi.advanceTimersByTime(10000) })
  for (const warning of warnings) {
    expect(screen.getByText(warning)).toHaveAttribute('role', 'alert')
    expect(screen.getByText(warning)).toHaveClass('bg-amber-50', 'text-amber-800')
  }
  expect(screen.queryByText(/held back by the quality check/)).not.toBeInTheDocument()
  expect(open).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  for (const warning of warnings) expect(screen.queryByText(warning)).not.toBeInTheDocument()
})
it('shows warnings and held-back questions together until Continue', async () => {
  const open = mount(1, false, warnings)
  await act(async () => { vi.advanceTimersByTime(10000) })
  for (const warning of warnings) expect(screen.getByText(warning)).toBeInTheDocument()
  expect(screen.getByText(/1 question\(s\) held back by the quality check/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Review them in the deck editor.' }))
  expect(open).toHaveBeenCalledWith(4, 'edit')
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.queryByText(/held back by the quality check/)).not.toBeInTheDocument()
})
it.each([false, true])('keeps flagged results until Continue, notebook=%s', async notebook => {
  const open = mount(1, notebook)
  await act(async () => { vi.advanceTimersByTime(10000) })
  expect(screen.getByText(/1 question\(s\) held back by the quality check/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Review them in the deck editor.' }))
  expect(open).toHaveBeenCalledWith(4, 'edit')
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.queryByText(/held back by the quality check/)).not.toBeInTheDocument()
})
it('shows only the failure, not the upload-complete card, when the job fails', () => {
  render(<StudioPanel notebookId="7" sourceIds={[]} jobs={[{ job_id: 'job-1', status: 'failed',
    error_message: 'Gemini failed on 4 of 4 section(s): quota used up' }]}
    artifacts={{ decks: [], canvases: [] }} progress={{}} refresh={vi.fn()} onJob={vi.fn()} open={vi.fn()} onCanvas={vi.fn()} />)
  expect(screen.getByRole('alert')).toHaveTextContent('Gemini failed on 4 of 4 section(s): quota used up')
  expect(screen.queryByText('Upload complete')).not.toBeInTheDocument()
  expect(screen.queryByText(/Redirecting/)).not.toBeInTheDocument()
})
