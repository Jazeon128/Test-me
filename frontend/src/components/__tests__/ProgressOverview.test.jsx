import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import ProgressOverview from '../ProgressOverview'
import { progressAPI, activityAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  progressAPI: { getStats: vi.fn().mockResolvedValue({ data: { questions_due: 4, total_questions_seen: 10,
    total_attempts: 20, questions_mastered: 5, overall_success_rate: 0.75, mastery_rate: 0.5,
    current_streak: 3, best_streak: 6, average_easiness_factor: 2.5 } }) },
  activityAPI: {
    get: vi.fn().mockResolvedValue({ data: { heatmap: [], longest_streak: 7, totals: { points: 100, canvases_created: 2 } } }),
    awards: vi.fn().mockResolvedValue({ data: { earned: [{ code: 'first', title: 'First practice', detail: 'One session finished' }],
      locked: [{ code: 'ten', title: 'Ten sessions', description: 'Finish ten sessions' }] } }),
  },
}))
it('keeps overall stats, streaks, activity, awards, notebook stats and review navigation', async () => {
  render(<MemoryRouter><Routes><Route path="/" element={<ProgressOverview notebookStats={[
    { notebook_id: 7, name: 'Biology', questions_mastered: 3, total_questions: 8, questions_due: 4 },
  ]} />} /><Route path="/review" element={<p>Review page</p>} /></Routes></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'Progress', exact: true })).toBeInTheDocument()
  for (const text of ['20 total attempts', '75%', '5 mastered', 'Best: 6', 'longest run', 'points', 'canvases',
    'First practice', 'One session finished', 'Ten sessions', 'Finish ten sessions', 'Biology', '3 / 8', '2.50']) {
    expect(screen.getByText(text)).toBeInTheDocument()
  }
  expect(progressAPI.getStats).toHaveBeenCalledTimes(1)
  expect(activityAPI.get).toHaveBeenCalledTimes(1)
  expect(activityAPI.awards).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Start Review Session' }))
  expect(await screen.findByText('Review page')).toBeInTheDocument()
})
