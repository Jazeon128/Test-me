import axios from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  delete window.electronAPI
  vi.resetModules()
})

describe('Electron backend URL', () => {
  it.each(['baseURL', 'baseUrl'])('uses %s for the first request', async (field) => {
    vi.resetModules()
    window.electronAPI = {
      getBackendPort: vi.fn().mockResolvedValue({
        success: true,
        data: { [field]: 'http://127.0.0.1:8123/api' },
      }),
    }
    const { default: api } = await import('../api')
    expect(api.defaults.baseURL).toBe('/api')
    const urls = []
    api.defaults.adapter = async (config) => {
      urls.push(axios.getUri(config))
      return { data: [], status: 200, statusText: 'OK', headers: {}, config }
    }
    await api.get('/documents/')
    await api.get('/questions/')
    await api.get('https://example.test/absolute')
    expect(urls).toEqual([
      'http://127.0.0.1:8123/api/documents/',
      'http://127.0.0.1:8123/api/questions/',
      'https://example.test/absolute',
    ])
    expect(window.electronAPI.getBackendPort).toHaveBeenCalledTimes(1)
  })
})
