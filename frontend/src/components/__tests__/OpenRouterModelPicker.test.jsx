import { useCallback, useEffect, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import OpenRouterModelPicker from '../OpenRouterModelPicker'
import api from '../../services/api'
import { serverMessage } from '../../utils/serverMessage'

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }))
const models = [
  {
    id: 'vendor/paid',
    name: 'Alpha Paid',
    prompt_per_million: '0.75',
    completion_per_million: '3.75',
    context_length: 1048576,
    free: false,
  },
  {
    id: 'vendor/free',
    name: 'Zeta Free',
    prompt_per_million: '0',
    completion_per_million: '0',
    context_length: 128000,
    free: true,
  },
  {
    id: 'vendor/unknown',
    name: 'Beta Unknown',
    prompt_per_million: null,
    completion_per_million: null,
    context_length: 200000,
    free: false,
  },
]

// Settings owns one catalog for both cards. This harness supplies the same API-backed contract.
function Picker({ saved = '' }) {
  const [selectedModel, setSelectedModel] = useState(saved)
  const [catalog, setCatalog] = useState({ loading: true, models: [] })
  const load = useCallback(async (refresh = false) => {
    setCatalog({ loading: true, models: [] })
    try {
      const { data } = await api.get(`/settings/openrouter/models${refresh ? '?refresh=true' : ''}`)
      setCatalog({ ...data, loading: false })
    } catch (error) {
      setCatalog({ loading: false, models: [], error: serverMessage(error) })
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])
  return (
    <OpenRouterModelPicker
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
      catalog={catalog}
      onReload={load}
    />
  )
}

const radios = () =>
  within(screen.getByRole('radiogroup', { name: 'OpenRouter models' })).queryAllByRole('radio')
const search = value =>
  fireEvent.change(screen.getByLabelText('Search models'), { target: { value } })
beforeEach(() => {
  vi.resetAllMocks()
  api.get.mockResolvedValue({ data: { models } })
})

async function openPicker(saved = '') {
  render(<Picker saved={saved} />)
  await screen.findByLabelText('Search models')
}

describe('OpenRouter model picker', () => {
  it('shows loading until the catalog arrives', async () => {
    let resolve
    api.get.mockReturnValue(
      new Promise(done => {
        resolve = done
      })
    )
    render(<Picker />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading models...')
    resolve({ data: { models } })
    await screen.findByLabelText('Search models')
  })

  it('searches id and name case-insensitively', async () => {
    await openPicker()
    search('VENDOR/PAID')
    expect(radios()).toHaveLength(1)
    expect(radios()[0].value).toBe('vendor/paid')
    search('zEtA')
    expect(radios()).toHaveLength(1)
    expect(radios()[0].value).toBe('vendor/free')
  })

  it('filters to free models', async () => {
    await openPicker()
    fireEvent.click(screen.getByLabelText('Free only'))
    expect(radios()).toHaveLength(1)
    expect(radios()[0].value).toBe('vendor/free')
  })

  it('formats prices, free models, unknown prices, and context', async () => {
    await openPicker()
    expect(screen.getByText('$0.75 / $3.75 per 1M')).toBeInTheDocument()
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Price unknown')).toBeInTheDocument()
    expect(screen.getByText('1,048,576 tokens')).toBeInTheDocument()
  })

  it('sorts price with free first and unknown last', async () => {
    await openPicker()
    expect(radios().map(radio => radio.value)).toEqual([
      'vendor/free',
      'vendor/paid',
      'vendor/unknown',
    ])
  })

  it('sorts by name and context', async () => {
    await openPicker()
    fireEvent.change(screen.getByLabelText('Sort models'), { target: { value: 'name' } })
    expect(radios().map(radio => radio.value)).toEqual([
      'vendor/paid',
      'vendor/unknown',
      'vendor/free',
    ])
    fireEvent.change(screen.getByLabelText('Sort models'), { target: { value: 'context' } })
    expect(radios().map(radio => radio.value)).toEqual([
      'vendor/paid',
      'vendor/unknown',
      'vendor/free',
    ])
  })

  it('caps results at 50 and shows more in batches of 50', async () => {
    api.get.mockResolvedValue({
      data: {
        models: Array.from({ length: 111 }, (_, index) => ({
          ...models[0],
          id: `model/${index}`,
          name: `Model ${index}`,
        })),
      },
    })
    await openPicker()
    expect(radios()).toHaveLength(50)
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(radios()).toHaveLength(100)
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(radios()).toHaveLength(111)
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    search('Model 110')
    expect(radios()).toHaveLength(1)
    search('')
    expect(radios()).toHaveLength(50)
  })

  it('pins the selected model when filtered out', async () => {
    await openPicker('vendor/paid')
    search('Zeta')
    expect(radios()).toHaveLength(1)
    const pinned = within(screen.getByLabelText('Selected model'))
    expect(pinned.getByText('Alpha Paid')).toBeInTheDocument()
    expect(pinned.getByText('$0.75 / $3.75 per 1M')).toBeInTheDocument()
    fireEvent.click(radios()[0])
    expect(radios()[0]).toBeChecked()
    expect(pinned.getByText('Zeta Free')).toBeInTheDocument()
  })

  it('shows a saved model missing from the catalog', async () => {
    await openPicker('retired/model')
    expect(screen.getByText('retired/model')).toBeInTheDocument()
    expect(screen.getByText('Not in the current catalog')).toBeInTheDocument()
  })

  it('refreshes with refresh=true', async () => {
    await openPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/settings/openrouter/models?refresh=true')
    )
    await screen.findByLabelText('Search models')
  })

  it('shows the stale catalog note', async () => {
    api.get.mockResolvedValue({ data: { models, stale: true } })
    await openPicker()
    expect(
      screen.getByText('Showing a cached list; OpenRouter could not be reached.')
    ).toBeInTheDocument()
  })

  it('shows the server error and retries', async () => {
    api.get.mockRejectedValueOnce({
      response: { data: { error: { message: 'Catalog unavailable' } } },
    })
    render(<Picker />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Catalog unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByLabelText('Search models')
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(radios()).toHaveLength(3)
  })
})

describe('cheap model prices', () => {
  it('keeps four significant digits below one dollar', async () => {
    api.get.mockResolvedValue({ data: { models: [{
      id: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash',
      prompt_per_million: '0.0198', completion_per_million: '0.396',
      context_length: 1048576, free: false,
    }] } })
    render(<Picker />)
    expect(await screen.findByText('$0.0198 / $0.396 per 1M')).toBeInTheDocument()
  })
})
