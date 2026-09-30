import { render, screen, act } from '@testing-library/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import GenerationProgress from '../GenerationProgress'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-30T12:00:05Z'))
})
afterEach(() => vi.useRealTimers())
it('shows steps, sections and elapsed time while preserving the spinner across polls', async () => {
  const status = { status: 'processing', current_step: 'Checking questions', current_question: 2,
    total_questions: 4, started_at: '2026-09-30T12:00:00Z', progress: 50, logs: [] }
  const { container, rerender } = render(<GenerationProgress status={status} />)
  expect(screen.getByText('Checking questions')).toBeInTheDocument()
  expect(screen.getByText('Section 2 of 4')).toBeInTheDocument()
  expect(screen.getByText('Elapsed 00:05')).toBeInTheDocument()
  expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
  expect(container.querySelector('.generation-fill').style.transform).toBe('scaleX(0.5)')
  const spinner = container.querySelector('.generation-spinner')
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  rerender(<GenerationProgress status={{ ...status }} />)
  expect(screen.getByText('Elapsed 00:07')).toBeInTheDocument()
  expect(container.querySelector('.generation-spinner')).toBe(spinner)
  expect(spinner.parentElement.className).not.toContain('animate-pulse')
})
