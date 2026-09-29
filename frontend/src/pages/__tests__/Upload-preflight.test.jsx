import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import Upload from '../Upload'
import { documentsAPI, statusAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  documentsAPI: { upload: vi.fn(), confirmGeneration: vi.fn(), cancelGeneration: vi.fn() },
  decksAPI: { list: vi.fn().mockResolvedValue({ data: [] }) },
  statusAPI: { get: vi.fn() },
}))

const rejected = {
  job_id: 'job-1', deck_id: 4, status: 'needs_confirmation',
  documents: [{ id: 9, filename: 'vlog.md' }],
  preflight: [{ document_id: 9, filename: 'vlog.md', checked: true, worth_generating: false, is_teachable: 0.08, is_transcript: 0.91 }],
}

async function dropFile(container) {
  const input = container.querySelector('input[type="file"]')
  const file = new File(['um so yeah'], 'vlog.md', { type: 'text/markdown' })
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  statusAPI.get.mockResolvedValue({ data: { status: 'processing', progress: 10, current_step: 'Parsing', logs: [] } })
})
afterEach(() => vi.useRealTimers())

describe('Upload pre-flight', () => {
  it('holds generation and explains the rejected source', async () => {
    documentsAPI.upload.mockResolvedValue({ data: rejected })
    const { container } = render(<MemoryRouter><Upload /></MemoryRouter>)
    await dropFile(container)

    expect(await screen.findByText('This may not have anything to study')).toBeInTheDocument()
    expect(screen.getByText(/8% teachable/)).toBeInTheDocument()
    expect(screen.getByText(/reads like a transcript/)).toBeInTheDocument()
    expect(statusAPI.get).not.toHaveBeenCalled()
  })

  it('generates from the stored upload when confirmed', async () => {
    documentsAPI.upload.mockResolvedValue({ data: rejected })
    documentsAPI.confirmGeneration.mockResolvedValue({ data: { job_id: 'job-1', deck_id: 4, status: 'processing' } })
    const { container } = render(<MemoryRouter><Upload /></MemoryRouter>)
    await dropFile(container)

    fireEvent.click(await screen.findByRole('button', { name: 'Generate anyway' }))

    await waitFor(() => expect(statusAPI.get).toHaveBeenCalledWith('job-1'))
    expect(documentsAPI.confirmGeneration).toHaveBeenCalledWith('job-1')
    expect(documentsAPI.upload).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('This may not have anything to study')).not.toBeInTheDocument()
  })

  it('cancels without generating', async () => {
    documentsAPI.upload.mockResolvedValue({ data: rejected })
    documentsAPI.cancelGeneration.mockResolvedValue({ data: { status: 'cancelled' } })
    const { container } = render(<MemoryRouter><Upload /></MemoryRouter>)
    await dropFile(container)

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel upload' }))

    await waitFor(() => expect(screen.queryByText('This may not have anything to study')).not.toBeInTheDocument())
    expect(documentsAPI.cancelGeneration).toHaveBeenCalledWith('job-1')
    expect(statusAPI.get).not.toHaveBeenCalled()
  })

  it('says when a source could not be checked', async () => {
    documentsAPI.upload.mockResolvedValue({ data: {
      ...rejected, status: 'processing',
      preflight: [{ ...rejected.preflight[0], checked: false, worth_generating: true, is_teachable: null }],
    } })
    const { container } = render(<MemoryRouter><Upload /></MemoryRouter>)
    await dropFile(container)

    expect(await screen.findByText(/Could not check vlog.md before generating/)).toBeInTheDocument()
  })

  it('shows the server reason when the upload fails', async () => {
    documentsAPI.upload.mockRejectedValue({ message: 'File type not allowed' })
    const { container } = render(<MemoryRouter><Upload /></MemoryRouter>)
    await dropFile(container)

    expect(await screen.findByText('File type not allowed')).toBeInTheDocument()
  })

  it('stops polling once generation fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    documentsAPI.upload.mockResolvedValue({ data: { ...rejected, status: 'processing', preflight: [] } })
    statusAPI.get.mockResolvedValue({ data: { status: 'failed', error_message: 'No provider', logs: [] } })
    const { container } = render(<MemoryRouter><Upload /></MemoryRouter>)
    await dropFile(container)
    await screen.findByText('No provider')

    const callsAfterFailure = statusAPI.get.mock.calls.length
    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(statusAPI.get.mock.calls.length).toBe(callsAfterFailure)
  })
})
