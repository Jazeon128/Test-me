import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { delete window.electronAPI; vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules() })
it('resolves the default voice URL against the browser location', async () => {
  vi.stubGlobal('window', { location: { href: 'http://localhost:5173/workspace' } })
  const { voiceURL } = await import('../api')
  expect(await voiceURL(1, [1, 2])).toBe('ws://localhost:5173/api/notebooks/1/voice?source_ids=1,2')
})
it('resolves the absolute Electron backend base and reuses request resolution', async () => {
  window.electronAPI = { getBackendPort: vi.fn().mockResolvedValue({ success: true, data: { baseURL: 'http://127.0.0.1:9000/api' } }) }
  const { voiceURL, ensureBaseURL } = await import('../api')
  expect(await voiceURL(1, [1, 2])).toBe('ws://127.0.0.1:9000/api/notebooks/1/voice?source_ids=1,2')
  expect(await ensureBaseURL()).toBe('http://127.0.0.1:9000/api')
  expect(window.electronAPI.getBackendPort).toHaveBeenCalledOnce()
})
