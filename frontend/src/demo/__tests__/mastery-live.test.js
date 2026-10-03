import axios from 'axios'
import { expect, it, vi } from 'vitest'
import fixture from '../../../demo/fixture.json'
import { createDemoAdapter } from '../adapter'

const apiFor = snapshot => axios.create({ adapter: createDemoAdapter(snapshot, { delay: () => 0 }) })
const read = async api => (await api.get('/notebooks/1/mastery')).data
const topic = fixture.routes['GET /notebooks/1/mastery'].topics[0]
const answer = (api, id, hinted = false) => {
  const question = fixture.routes[`GET /questions/${id}`]
  return api.post('/progress/submit', { question_id: id, time_taken_seconds: 3,
    ...(question.card_type === 'flashcard' ? { manual_quality: 4 }
      : { selected_option: question.options.find(option => option.is_correct).option, hint_used: hinted }) })
}

it.each([false, true])('updates the recorded four-question topic with hinted=%s', async hinted => {
  const api = apiFor(fixture)
  expect((await read(api)).topics[0].level).toBe('not_started')
  for (const id of topic.question_ids) await answer(api, id, hinted && id === topic.question_ids[0])
  const mastery = await read(api)
  expect(mastery.topics[0]).toMatchObject({ attempted_count: 4, correct_count: hinted ? 3 : 4,
    level: hinted ? 'familiar' : 'proficient' })
  expect(mastery.summary.proficient_or_above).toBe(hinted ? 0 : 1)
  expect(mastery.summary.levels).toMatchObject({ not_started: 6, familiar: hinted ? 1 : 0, proficient: hinted ? 0 : 1 })
  expect((await read(apiFor(fixture))).topics[0].level).toBe('not_started')
})

it('keeps recorded attempts as the starting state', async () => {
  const snapshot = structuredClone(fixture)
  Object.assign(snapshot.routes['GET /notebooks/1/mastery'].topics[0], {
    attempted_count: 3, correct_count: 3, level: 'familiar',
  })
  const api = apiFor(snapshot)
  await answer(api, topic.question_ids[3])
  expect((await read(api)).topics[0]).toMatchObject({ attempted_count: 4, correct_count: 4, level: 'proficient' })
  await api.post('/progress/submit', { question_id: topic.question_ids[0], selected_option: 'wrong' })
  expect((await read(api)).topics[0]).toMatchObject({ attempted_count: 4, correct_count: 3, level: 'familiar' })
})

it('requires unhinted repeated answers on different UTC days in the adapter', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  try {
    const api = apiFor(fixture)
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
    for (const id of topic.question_ids) await answer(api, id)
    for (const id of topic.question_ids) await answer(api, id)
    expect((await read(api)).topics[0].level).toBe('proficient')
    vi.setSystemTime(new Date('2026-10-02T12:00:00Z'))
    for (const id of topic.question_ids) await answer(api, id)
    expect((await read(api)).topics[0].level).toBe('mastered')
  } finally { vi.useRealTimers() }
})
