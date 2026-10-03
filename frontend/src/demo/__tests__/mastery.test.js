import axios from 'axios'
import { expect, it } from 'vitest'
import { createDemoAdapter } from '../adapter'
import sample from './fixture.sample.json'

it('returns empty mastery for an unrecorded mastery route', async () => {
  const api = axios.create({ adapter: createDemoAdapter(sample, { delay: () => 0 }) })
  expect((await api.get('/notebooks/1/mastery')).data).toEqual({
    topics: [], summary: { topic_count: 0, proficient_or_above: 0,
      levels: { not_started: 0, attempted: 0, familiar: 0, proficient: 0, mastered: 0 } },
  })
})

it('returns recorded mastery when available', async () => {
  const mastery = { topics: [{ key: '1:Intro' }], summary: { topic_count: 1 } }
  const api = axios.create({ adapter: createDemoAdapter({ ...sample,
    routes: { ...sample.routes, 'GET /notebooks/1/mastery': mastery },
  }, { delay: () => 0 }) })
  expect((await api.get('/notebooks/1/mastery')).data).toEqual(mastery)
})
