import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import Upload from '../Upload'
import { documentsAPI, statusAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  documentsAPI: { upload: vi.fn() },
  decksAPI: { list: vi.fn().mockResolvedValue({ data: [] }) },
  statusAPI: { get: vi.fn() },
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-30T12:00:05Z'))
  vi.clearAllMocks()
  documentsAPI.upload.mockResolvedValue({ data: { job_id: 'job-1' } })
  statusAPI.get.mockResolvedValue({ data: {
    status: 'processing', current_step: 'Checking questions', current_question: 2,
    total_questions: 4, started_at: '2026-09-30T12:00:00Z', progress: 50, logs: [],
  } })
})
afterEach(() => vi.useRealTimers())

describe('Upload generation progress', () => {
  it('shows steps, sections and elapsed time while preserving the spinner across polls', async () => {
    const { container } = render(<MemoryRouter><Upload /></MemoryRouter>)
    await act(async () => {
      fireEvent.change(container.querySelector('input[type="file"]'), {
        target: { files: [new File(['text'], 'source.md', { type: 'text/markdown' })] },
      })
    })
    expect(screen.getByText('Checking questions')).toBeInTheDocument()
    expect(screen.getByText('Section 2 of 4')).toBeInTheDocument()
    expect(screen.getByText('Elapsed 00:05')).toBeInTheDocument()
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(container.querySelector('.generation-fill').style.transform).toBe('scaleX(0.5)')
    const spinner = container.querySelector('.generation-spinner')
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(screen.getByText('Elapsed 00:07')).toBeInTheDocument()
    expect(container.querySelector('.generation-spinner')).toBe(spinner)
    expect(container.querySelector('.generation-spinner').parentElement.className).not.toContain('animate-pulse')
  })

  it('shows only the failure, not the upload-complete card, when the job fails', async () => {
    documentsAPI.upload.mockResolvedValue({ data: { job_id: 'job-1', message: '1 document(s) uploaded.' } })
    statusAPI.get.mockResolvedValue({ data: {
      status: 'failed', error_message: 'Gemini failed on 4 of 4 section(s): quota used up',
      current_step: 'Failed', logs: [],
    } })
    const { container } = render(<MemoryRouter><Upload /></MemoryRouter>)
    await act(async () => {
      fireEvent.change(container.querySelector('input[type="file"]'), {
        target: { files: [new File(['text'], 'source.md', { type: 'text/markdown' })] },
      })
    })
    expect(screen.getByText('Upload failed')).toBeInTheDocument()
    expect(screen.queryByText('Upload complete')).not.toBeInTheDocument()
    expect(screen.queryByText(/Redirecting/)).not.toBeInTheDocument()
  })
})
