import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDemoAdapter } from '../adapter'
import { DEMO_NOTICE } from '../notice'
import sample from './fixture.sample.json'

let api
beforeEach(() => { api = axios.create({ adapter: createDemoAdapter(sample, { delay: () => 0 }) }) })
const submit = (question_id, values = {}) => api.post('/progress/submit', { question_id, selected_option: 'A', time_taken_seconds: 10, ...values })

describe('recorded reads and blocked writes', () => {
  it('returns a recorded GET with query params ignored and independent data', async () => {
    const first = await api.get('/api/notebooks/?anything=yes')
    expect(first.data[0].name).toBe('The learning pyramid')
    first.data[0].name = 'Changed'
    expect((await api.get('/notebooks/')).data[0].name).toBe('The learning pyramid')
  })
  it('rejects an unrecorded GET with axios 404', async () => {
    await expect(api.get('/missing')).rejects.toMatchObject({ response: { status: 404, data: { detail: 'Not part of the demo.' } } })
  })
  it.each(['post', 'put', 'patch', 'delete'])('blocks %s upload with the notice', async method => {
    await expect(api[method]('/documents/upload', {})).rejects.toMatchObject({ response: { status: 403, data: { detail: DEMO_NOTICE } } })
  })
  it('blocks export GET and leaves settings unrecorded', async () => {
    await expect(api.get('/tests/1/export/csv')).rejects.toMatchObject({ response: { status: 403, data: { detail: DEMO_NOTICE } } })
    await expect(api.get('/settings/ai-config')).rejects.toMatchObject({ response: { status: 404 } })
  })
  it('waits 150 to 300 ms with the default delay', async () => {
    vi.useFakeTimers()
    try {
      const adapter = createDemoAdapter(sample)
      let resolved = false
      const response = adapter({ url: '/notebooks/', method: 'get' }).then(() => { resolved = true })
      await vi.advanceTimersByTimeAsync(149)
      expect(resolved).toBe(false)
      await vi.advanceTimersByTimeAsync(151)
      await response
      expect(resolved).toBe(true)
    } finally { vi.useRealTimers() }
  })
})

describe('question bank', () => {
  it('searches case-insensitively and pages in the backend shape', async () => {
    const { data } = await api.get('/notebooks/1/questions', { params: { q: 'RECALL', page: 2, page_size: 1 } })
    expect(data).toMatchObject({ total: 2, offset: 1, limit: 1 })
    expect(data.items.map(item => item.id)).toEqual([1])
    expect((await api.get('/notebooks/1/questions?search=pyramid&offset=0&limit=1')).data.items[0].id).toBe(2)
  })
  it.each([
    [{ difficulty: 'easy' }, [3, 1]], [{ card_type: 'flashcard' }, [4, 3]],
    [{ deck_id: 1 }, [2, 1]], [{ source_id: 1 }, [4, 3, 2, 1]],
    [{ tag_id: 999 }, []], [{ status: 'new' }, [4, 3, 2, 1]],
  ])('applies recorded filters %j', async (params, ids) => {
    expect((await api.get('/notebooks/1/questions', { params })).data.items.map(item => item.id)).toEqual(ids)
  })
  it('returns the separate held-back tab', async () => {
    expect((await api.get('/notebooks/1/held-back')).data).toEqual([])
  })
})

describe('practice progress', () => {
  it('grades correct and wrong MCQ answers and schedules new cards for 1 day', async () => {
    const correct = (await submit(1)).data
    expect(correct).toMatchObject({ correct: true, correct_answer: 'A', progress: { interval_days: 1, times_correct: 1 }, gamification: { points_earned: 10 } })
    const wrong = (await submit(2)).data
    expect(wrong).toMatchObject({ correct: false, correct_answer: 'B', progress: { interval_days: 1, times_incorrect: 1 } })
    expect(Date.parse(correct.progress.next_review_date) - Date.now()).toBeGreaterThan(86390000)
  })
  it.each([[2, false], [3, true], [5, true]])('grades flashcard quality %i as %s', async (manual_quality, correct) => {
    expect((await submit(3, { selected_option: '', manual_quality })).data).toMatchObject({ correct, correct_answer: null, progress: { interval_days: 1 } })
  })
  it('rejects flashcards without quality and provider grading', async () => {
    await expect(submit(3)).rejects.toMatchObject({ response: { status: 422 } })
    await expect(submit(1, { written_answer: 'An answer' })).rejects.toMatchObject({ response: { status: 403 } })
  })
  it('moves stats, notebook counters, bank status, and review selection in memory', async () => {
    expect((await api.get('/progress/stats')).data.total_attempts).toBe(0)
    await submit(1)
    await submit(2)
    expect((await api.get('/progress/stats')).data).toMatchObject({ total_attempts: 2, total_questions_seen: 2, overall_success_rate: 0.5 })
    expect((await api.get('/progress/stats/by-notebook')).data[0]).toMatchObject({ questions_seen: 2, total_attempts: 2, success_rate: 0.5 })
    expect((await api.get('/notebooks/1/workspace')).data.progress).toMatchObject({ answered_count: 2, correct_rate: 0.5 })
    expect((await api.get('/notebooks/1/questions?status=learning')).data.total).toBe(2)
    expect((await api.get('/progress/question/1')).data.times_seen).toBe(1)
    expect((await api.post('/progress/review-session', { num_questions: 10, include_new: true })).data.questions.map(item => item.id)).toEqual([3, 4])
  })
  it('builds notebook practice and deck-filtered review sessions', async () => {
    const { data } = await api.post('/notebooks/1/questions/practice', { question_ids: [2, 1] })
    expect(data.num_questions).toBe(2)
    expect(data.questions.map(item => item.correct_option)).toEqual(['B', 'A'])
    expect(data.questions[0].options[0]).toEqual({ option: 'A', text: 'Always' })
    expect((await api.post('/progress/review-session', { deck_id: 2, num_questions: 1 })).data.questions[0].id).toBe(3)
  })
})

it('keeps canvas patch and restores original without changing the snapshot', async () => {
  await api.patch('/canvas/1', { title: 'My canvas', edited: { nodes: [] }, layout: { recall: { x: 20, y: 30 } } })
  expect((await api.get('/canvas/1')).data).toMatchObject({ title: 'My canvas', has_edits: true, edited: { nodes: [] } })
  await api.patch('/canvas/1', { edited: null, layout: null })
  expect((await api.get('/canvas/1')).data).toMatchObject({ has_edits: false, edited: null, layout: null })
  expect(sample.routes['GET /canvas/1'].title).toBe('Learning practice')
})

it('replays an exact recorded chat question and blocks new messages', async () => {
  const { data: history } = await api.get('/notebooks/1/chat')
  const { data: replay } = await api.post('/notebooks/1/chat', { message: history[0].content })
  expect(replay).toEqual({ ...history[1], id: 3 })
  await expect(api.post('/notebooks/1/chat', { message: 'New question' })).rejects.toMatchObject({ response: { status: 403, data: { detail: DEMO_NOTICE } } })
})
