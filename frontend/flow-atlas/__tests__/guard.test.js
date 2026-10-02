import { describe, expect, it, vi } from 'vitest'
import { buildManifest, isBlocked, isProviderRead, modelCatalogue, stubModelCatalogue, slugify, stepFileName } from '../guard.js'

describe('paid endpoint guard', () => {
  const paid = [
    '/api/canvas/generate', '/api/canvas/12/nodes/section-3/questions',
    '/api/notebooks/24/generate', '/api/notebooks/24/sources', '/api/notebooks/24/chat',
    '/api/documents/upload', '/api/documents/jobs/7e43ab-28/confirm',
    '/api/questions/315/grade', '/api/questions/duplicates',
    '/api/settings/typesafe/test', '/api/settings/ai-config/test',
    '/api/settings/ai-config/models/refresh',
  ]
  it.each(paid)('blocks POST %s with query strings and trailing slashes', endpoint => {
    expect(isBlocked('POST', `http://localhost:5174${endpoint}?atlas=1`)).toBe(true)
    expect(isBlocked('post', `${endpoint}/?atlas=1`)).toBe(true)
    expect(isBlocked('GET', endpoint)).toBe(false)
  })
  it.each(['POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'])('blocks %s under settings', method => {
    expect(isBlocked(method, '/api/settings/ai-config?x=1')).toBe(true)
  })
  it.each([
    ['GET', '/api/notebooks/2/workspace'], ['GET', '/api/settings/ai-config'],
    ['POST', '/api/progress/submit'], ['POST', '/api/decks/'],
    ['PATCH', '/api/canvas/1'], ['POST', '/api/notebooks/2/questions/practice'],
  ])('allows %s %s', (method, url) => { expect(isBlocked(method, url)).toBe(false) })
  it('does not confuse similar paths with paid routes', () => {
    expect(isBlocked('POST', '/api/settings-extra/test')).toBe(false)
    expect(isBlocked('POST', '/api/notebooks/2/chat-history')).toBe(false)
    expect(isBlocked('POST', '/api/canvas/1/nodes/2/questions/extra')).toBe(false)
  })
  it('identifies provider reads separately', () => {
    expect(isProviderRead('/api/questions/315/suggested-tags?x=1')).toBe(true)
    expect(isBlocked('GET', '/api/questions/315/suggested-tags')).toBe(false)
    expect(isProviderRead('/api/questions/315')).toBe(false)
    expect(isProviderRead('/api/search/?q=Bedrock')).toBe(true)
    expect(isProviderRead('/api/settings/openrouter/models?refresh=true')).toBe(true)
    expect(isProviderRead('/api/settings/openrouter/key')).toBe(true)
  })
})

describe('manifest helpers', () => {
  it('creates stable safe slugs', () => {
    expect(slugify(' Chat: Citation (3) ')).toBe('chat-citation-3')
    expect(slugify('Réview / Form')).toBe('review-form')
    expect(slugify('!!!')).toBe('step')
  })
  it('numbers steps from one and includes viewport', () => {
    expect(stepFileName(0, 1, 'Chat citation', 'desktop')).toBe('shots/01-02-chat-citation-desktop.jpg')
    expect(stepFileName(9, 4, 'Canvas', 'mobile')).toBe('shots/10-05-canvas-mobile.jpg')
  })
  it('builds the required manifest without shared mutable arrays', () => {
    const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } }
    const manifest = buildManifest('abc123', viewports, '2026-10-02T12:00:00.000Z')
    expect(manifest).toEqual({ generated_at: '2026-10-02T12:00:00.000Z', git_sha: 'abc123', viewports, flows: [], blocked: [], stubbed: [], errors: [] })
    manifest.flows.push({ id: 'chat', title: 'Chat', steps: [{ id: 'citation', title: 'Citation passage', action: 'Click citation', viewport: 'desktop', url: '/notebooks/2?view=questions', file: stepFileName(0, 0, 'citation', 'desktop') }] })
    expect(JSON.parse(JSON.stringify(manifest)).flows[0].steps[0]).toEqual({ id: 'citation', title: 'Citation passage', action: 'Click citation', viewport: 'desktop', url: '/notebooks/2?view=questions', file: 'shots/01-01-citation-desktop.jpg' })
    expect(buildManifest('abc123', viewports).flows).toEqual([])
  })
})

it('stubs the model GET without blocking it and leaves the key GET blocked', async () => {
  const manifest = buildManifest('abc', {})
  const catalogue = modelCatalogue(['selected/model'], '2026-10-02T12:00:00.000Z')
  const route = { request: () => ({ method: () => 'GET', url: () => 'http://localhost:5174/api/settings/openrouter/models?refresh=true' }), fulfill: vi.fn() }
  expect(await stubModelCatalogue(route, catalogue, manifest, 'settings')).toBe(true)
  expect(route.fulfill).toHaveBeenCalledWith({ status: 200, contentType: 'application/json', body: JSON.stringify(catalogue) })
  expect(manifest.stubbed).toHaveLength(1)
  expect(manifest.blocked).toEqual([])
  expect(catalogue.models).toHaveLength(3)
  expect(catalogue.models[0].id).toBe('selected/model')
  const keyRoute = { request: () => ({ method: () => 'GET', url: () => 'http://localhost:5174/api/settings/openrouter/key' }), fulfill: vi.fn() }
  expect(await stubModelCatalogue(keyRoute, catalogue, manifest, 'settings')).toBe(false)
  expect(keyRoute.fulfill).not.toHaveBeenCalled()
  expect(isProviderRead(keyRoute.request().url())).toBe(true)
  expect(isBlocked('POST', route.request().url())).toBe(true)
})
