import { describe, expect, it, vi } from 'vitest'
import { checkPrivacy, snapshot, sortedJSON } from '../../../demo/snapshot'
import fixture from './fixture.sample.json'

describe('snapshot privacy', () => {
  it.each(['sk-testsecret', 'AIzaTestSecret', 'C:\\Users\\private', 'api_key', 'API_KEY'])('rejects %s and identifies the key path', value => {
    expect(() => checkPrivacy({ routes: { source: { text: value } } })).toThrow('$.routes.source.text')
  })
  it.each(['sk-testsecret', 'AIzaTestSecret', 'C:\\Users\\private', 'API_KEY'])('rejects sensitive key %s with its key path', key => {
    expect(() => checkPrivacy({ routes: { [key]: 'redacted' } })).toThrow(`$.routes.${key}`)
  })
  it.each(['risk-free', 'task-based learning'])('allows ordinary study text %s in keys and values', text => {
    expect(() => checkPrivacy({ [text]: text })).not.toThrow()
  })
  it('checks keys and nested arrays', () => {
    expect(() => checkPrivacy({ api_key: 'redacted' })).toThrow('$.api_key')
    expect(() => checkPrivacy({ items: [{ secret: 'sk-testsecret' }] })).toThrow('$.items.0.secret')
    expect(() => checkPrivacy(fixture)).not.toThrow()
  })
  it('sorts keys recursively with 2-space indent', () => {
    expect(sortedJSON({ z: [{ b: 2, a: 1 }], a: 0 })).toBe('{\n  "a": 0,\n  "z": [\n    {\n      "a": 1,\n      "b": 2\n    }\n  ]\n}\n')
  })
})

it('uses GET only, follows pages, and excludes other notebook lists', async () => {
  const fetcher = vi.fn(async (address, options) => {
    expect(options.method).toBe('GET')
    const url = new URL(address)
    const route = `GET ${url.pathname.replace('/api', '')}`
    let data = fixture.routes[route]
    if (route === 'GET /notebooks/') data = [...data, { id: 99, name: 'Private notebook' }]
    if (route === 'GET /progress/stats/by-notebook') data = [...data, { notebook_id: 99, name: 'Private notebook' }]
    if (route === 'GET /notebooks/1/questions') {
      const offset = Number(url.searchParams.get('offset'))
      data = { ...data, items: data.items.slice(offset, offset + 2) }
    }
    if (data === undefined) throw new Error(`Unmocked request ${route}`)
    return { ok: true, json: async () => JSON.parse(JSON.stringify(data)) }
  })
  const result = await snapshot({ api: 'http://127.0.0.1:8002', notebook: 'The learning pyramid', fetcher })
  expect(result.routes['GET /notebooks/']).toHaveLength(1)
  expect(result.routes['GET /notebooks/1/questions'].items).toHaveLength(4)
  expect(result.routes['GET /progress/stats/by-notebook']).toHaveLength(1)
  expect(sortedJSON(result)).not.toContain('Private notebook')
  expect(fetcher.mock.calls.some(([url]) => url.includes('settings'))).toBe(false)
  expect(result.routes['GET /canvas/1/nodes/recall/source']).toBeDefined()
})
