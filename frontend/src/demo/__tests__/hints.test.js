import axios from 'axios'
import { expect, it } from 'vitest'
import { createDemoAdapter } from '../adapter'
import sample from './fixture.sample.json'

it('accepts hinted multiple-choice answers in the demo adapter', async () => {
  const api = axios.create({ adapter: createDemoAdapter(sample, { delay: () => 0 }) })
  const { data } = await api.post('/progress/submit', {
    question_id: 1, selected_option: 'A', time_taken_seconds: 2,
    manual_quality: 5, hint_used: true,
  })
  expect(data.correct).toBe(true)
  expect(data.progress.times_seen).toBeGreaterThan(0)
})
