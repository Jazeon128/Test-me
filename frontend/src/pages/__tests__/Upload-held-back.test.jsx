import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import Upload from '../Upload'
import { documentsAPI, statusAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  documentsAPI: { upload: vi.fn(), confirmGeneration: vi.fn(), cancelGeneration: vi.fn() },
  decksAPI: { list: vi.fn().mockResolvedValue({ data: [] }) },
  statusAPI: { get: vi.fn() },
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  documentsAPI.upload.mockResolvedValue({ data: {
    job_id: 'held-job', deck_id: 4, status: 'processing', preflight: [],
  } })
})

afterEach(() => vi.useRealTimers())

async function completedUpload(count, notebook = false, warnings) {
  statusAPI.get.mockResolvedValue({ data: {
    status: 'completed', deck_id: 4, progress: 100, current_step: 'Complete', logs: [],
    total_questions_generated: 2, total_questions_flagged: count, warnings,
  } })
  const { container } = render(
    <MemoryRouter initialEntries={[notebook ? '/upload?notebook=9' : '/upload']}>
      <Routes>
        <Route path="/upload" element={<Upload />} />
        <Route path="/decks/4" element={<p>Deck destination</p>} />
        <Route path="/notebooks/9" element={<p>Notebook destination</p>} />
      </Routes>
    </MemoryRouter>
  )
  await act(async () => {
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['Source'], 'source.md', { type: 'text/markdown' })] },
    })
  })
  expect(statusAPI.get).toHaveBeenCalledWith('held-job')
}

describe('Upload held-back completion', () => {
  const warnings = [
    'Generated 1 of 4 question(s). Gemini failed on 3 section(s): 503 UNAVAILABLE',
    'Some source sections could not be processed.',
  ]

  it.each([false, true])('keeps warnings until Continue, notebook=%s', async notebook => {
    await completedUpload(0, notebook, warnings)
    await act(async () => { vi.advanceTimersByTime(10000) })
    for (const warning of warnings) {
      expect(screen.getByText(warning)).toHaveAttribute('role', 'alert')
      expect(screen.getByText(warning)).toHaveClass('bg-amber-50', 'text-amber-800')
    }
    expect(screen.queryByText(/held back by the quality check/)).not.toBeInTheDocument()
    expect(screen.queryByText('Redirecting to deck view...')).not.toBeInTheDocument()
    expect(screen.queryByText('Deck destination')).not.toBeInTheDocument()
    expect(screen.queryByText('Notebook destination')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText(notebook ? 'Notebook destination' : 'Deck destination')).toBeInTheDocument()
  })

  it('shows warnings and held-back questions together until Continue', async () => {
    await completedUpload(1, false, warnings)
    await act(async () => { vi.advanceTimersByTime(10000) })
    for (const warning of warnings) expect(screen.getByText(warning)).toBeInTheDocument()
    expect(screen.getByText(/1 question\(s\) held back by the quality check/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review them on the deck page.' })).toHaveAttribute('href', '/decks/4')
    expect(screen.queryByText('Redirecting to deck view...')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText('Deck destination')).toBeInTheDocument()
  })

  it('auto-navigates after 2000 ms with no warnings or held-back questions', async () => {
    await completedUpload(0, false, [])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
    expect(screen.getByText('Redirecting to deck view...')).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(1999) })
    expect(screen.queryByText('Deck destination')).not.toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(screen.getByText('Deck destination')).toBeInTheDocument()
  })

  it.each([false, true])('keeps flagged results until Continue, notebook=%s', async notebook => {
    await completedUpload(1, notebook)
    await act(async () => { vi.advanceTimersByTime(10000) })
    expect(screen.getByText(/1 question\(s\) held back by the quality check/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review them on the deck page.' })).toHaveAttribute('href', '/decks/4')
    expect(screen.queryByText('Redirecting to deck view...')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText(notebook ? 'Notebook destination' : 'Deck destination')).toBeInTheDocument()
  })

  it.each([0, undefined])('auto-navigates after 2000 ms when count is %s', async count => {
    await completedUpload(count)
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(1999) })
    expect(screen.queryByText('Deck destination')).not.toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(screen.getByText('Deck destination')).toBeInTheDocument()
  })

  it('keeps notebook auto-navigation when none were held back', async () => {
    await completedUpload(0, true)
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(screen.getByText('Notebook destination')).toBeInTheDocument()
  })
})
