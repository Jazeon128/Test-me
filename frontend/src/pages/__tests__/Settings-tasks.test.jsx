import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Settings from '../Settings'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
vi.mock('../../context/useTheme', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}))
vi.mock('../../components/TypeSafeKeyCard', () => ({ default: () => <div>TypeSafe key</div> }))

const models = [
  {
    id: 'gpt-test',
    provider: 'openai',
    name: 'GPT Test',
    context_window: 128000,
    input_price: 1,
    output_price: 2,
  },
  {
    id: 'claude-test',
    provider: 'anthropic',
    name: 'Claude Test',
    context_window: 200000,
    input_price: 3,
    output_price: 4,
  },
]
const routerModels = [
  {
    id: 'vendor/model',
    name: 'Router Model',
    free: false,
    prompt_per_million: '0.75',
    completion_per_million: '3.75',
    context_length: 1048576,
  },
]
let config
let balanceError
const card = task => within(screen.getByRole('region', { name: task }))
const keyRow = provider => within(screen.getByRole('region', { name: `${provider} API key` }))

beforeEach(() => {
  vi.resetAllMocks()
  balanceError = false
  config = {
    generation_provider: 'openai',
    generation_model: 'gpt-test',
    chat_provider: 'anthropic',
    chat_model: 'claude-test',
    key_configured: true,
    key_source: 'keyring',
  }
  api.get.mockImplementation(async url => {
    if (url === '/settings/ai-config') return { data: config }
    if (url === '/settings/ai-config/models') return { data: models }
    if (url.startsWith('/settings/openrouter/models')) return { data: { models: routerModels } }
    if (url === '/settings/openrouter/key') {
      if (balanceError) throw { response: { status: 400 } }
      return { data: { limit: 10, limit_remaining: 7.5, usage: 2.5 } }
    }
    throw new Error(`Unexpected endpoint ${url}`)
  })
  api.post.mockResolvedValue({ data: { message: 'Saved' } })
})

async function openSettings() {
  render(<Settings />)
  await screen.findByRole('region', { name: 'Question generation' })
}

async function selectRouter(task = 'Question generation') {
  fireEvent.change(card(task).getByLabelText('API Provider'), { target: { value: 'openrouter' } })
  fireEvent.click(await card(task).findByRole('radio', { name: /Router Model/ }))
}

describe('Settings task configuration', () => {
  it('renders both saved task pairs and provider key statuses', async () => {
    await openSettings()
    expect(card('Question generation').getByLabelText('API Provider')).toHaveValue('openai')
    expect(card('Question generation').getByLabelText('AI Model')).toHaveValue('gpt-test')
    expect(card('Chat').getByLabelText('API Provider')).toHaveValue('anthropic')
    expect(card('Chat').getByLabelText('AI Model')).toHaveValue('claude-test')
    expect(keyRow('OpenAI').getByText('Saved in the system credential store')).toBeInTheDocument()
    expect(keyRow('Anthropic').getByText('Status shown after saving')).toBeInTheDocument()
  })

  it('switches generation to OpenRouter and saves without a key', async () => {
    await openSettings()
    await selectRouter()
    fireEvent.click(card('Question generation').getByRole('button', { name: 'Save Configuration' }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/settings/ai-config', {
        provider: 'openrouter',
        model: 'vendor/model',
        task: 'generation',
      })
    )
    expect(
      screen.queryByText('Please re-enter your API key to save changes')
    ).not.toBeInTheDocument()
  })

  it('saves chat independently and shares the catalog between cards', async () => {
    await openSettings()
    await selectRouter()
    await selectRouter('Chat')
    fireEvent.click(card('Chat').getByRole('button', { name: 'Save Configuration' }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/settings/ai-config', {
        provider: 'openrouter',
        model: 'vendor/model',
        task: 'chat',
      })
    )
    expect(
      api.get.mock.calls.filter(([url]) => url === '/settings/openrouter/models')
    ).toHaveLength(1)
    expect(screen.getAllByRole('region', { name: 'OpenRouter API key' })).toHaveLength(1)
  })

  it('shows missing-key errors on the matching key row', async () => {
    api.post.mockRejectedValue({
      originalError: {
        response: {
          status: 400,
          data: { error: { message: 'No openrouter API key is saved yet. Enter one.' } },
        },
      },
    })
    await openSettings()
    await selectRouter()
    fireEvent.click(card('Question generation').getByRole('button', { name: 'Save Configuration' }))
    expect(await keyRow('OpenRouter').findByRole('alert')).toHaveTextContent(
      'No openrouter API key is saved yet. Enter one.'
    )
  })

  it('saves a key with the generation pair, clears the input, and reloads status', async () => {
    await openSettings()
    const row = keyRow('OpenAI')
    const input = row.getByLabelText('OpenAI API Key')
    fireEvent.change(input, { target: { value: 'secret-key' } })
    fireEvent.click(row.getByRole('button', { name: 'Save key' }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/settings/ai-config', {
        provider: 'openai',
        api_key: 'secret-key',
        task: 'generation',
        model: 'gpt-test',
      })
    )
    await waitFor(() => expect(input).toHaveValue(''))
    expect(api.get.mock.calls.filter(([url]) => url === '/settings/ai-config')).toHaveLength(2)
  })

  it('saves a chat-only provider key with the chat pair', async () => {
    await openSettings()
    fireEvent.change(keyRow('Anthropic').getByLabelText('Anthropic API Key'), {
      target: { value: 'chat-secret' },
    })
    fireEvent.click(keyRow('Anthropic').getByRole('button', { name: 'Save key' }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/settings/ai-config', {
        provider: 'anthropic',
        api_key: 'chat-secret',
        task: 'chat',
        model: 'claude-test',
      })
    )
  })

  it.each([
    ['env', true, 'Using the key from backend/.env'],
    [
      'database',
      true,
      'Saved in the app database. Save it again to move it to the credential store.',
    ],
    [null, false, 'Not set'],
  ])('renders key source %s', async (key_source, key_configured, text) => {
    config = { ...config, key_source, key_configured }
    await openSettings()
    expect(keyRow('OpenAI').getByText(text)).toBeInTheDocument()
  })

  it('shows OpenRouter balance and hides it when neither task uses OpenRouter', async () => {
    await openSettings()
    await selectRouter('Chat')
    expect(await screen.findByText('OpenRouter credit: $7.50 of $10.00 left')).toBeInTheDocument()
    fireEvent.change(card('Chat').getByLabelText('API Provider'), {
      target: { value: 'anthropic' },
    })
    expect(screen.queryByText(/OpenRouter credit:/)).not.toBeInTheDocument()
  })

  it('hides OpenRouter balance on 400', async () => {
    balanceError = true
    await openSettings()
    await selectRouter()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings/openrouter/key'))
    expect(screen.queryByText(/OpenRouter credit:/)).not.toBeInTheDocument()
  })

  it('renders usage without a credit limit', async () => {
    const original = api.get.getMockImplementation()
    api.get.mockImplementation(url =>
      url === '/settings/openrouter/key'
        ? Promise.resolve({ data: { limit: null, usage: 1.234 } })
        : original(url)
    )
    await openSettings()
    await selectRouter()
    expect(await screen.findByText('No credit limit, $1.23 used')).toBeInTheDocument()
  })
})
