import { useState } from 'react'
import api from '../../services/api'
import { serverMessage } from '../../utils/serverMessage'

const names = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
}
const statuses = {
  keyring: 'Saved in the system credential store',
  env: 'Using the key from backend/.env',
  database: 'Saved in the app database. Save it again to move it to the credential store.',
}

function ProviderKeyRow({ provider, task, model, status, error, onSaved, onClearError }) {
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const save = async () => {
    if (!key.trim()) {
      setMessage('Please enter an API key')
      return
    }
    setSaving(true)
    setMessage(null)
    onClearError(provider)
    try {
      await api.post('/settings/ai-config', { provider, api_key: key, task, model })
      setKey('')
      await onSaved()
      setMessage('API key saved')
    } catch (error) {
      setMessage(serverMessage(error.originalError || error) || 'Failed to save API key')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label={`${names[provider]} API key`} className="space-y-2">
      <label htmlFor={`${provider}-key`}>{names[provider]} API Key</label>
      <p className="text-sm">{status}</p>
      <input
        id={`${provider}-key`}
        type="password"
        autoComplete="new-password"
        value={key}
        onChange={event => setKey(event.target.value)}
        placeholder="Enter your API key"
        className="w-full p-3 border rounded-lg bg-white dark:bg-gray-900"
      />
      <button
        onClick={save}
        disabled={saving || !model.trim()}
        className="bg-primary-600 text-white px-4 py-2 rounded-lg"
      >
        {saving ? 'Saving...' : 'Save key'}
      </button>
      {(error || message) && <p role="alert">{error || message}</p>}
    </section>
  )
}

export default function ProviderKeys({ tasks, config, errors, onSaved, onClearError }) {
  const providers = [...new Set([tasks.generation.provider, tasks.chat.provider])]
  const generationProvider = config?.generation_provider || config?.provider

  return (
    <section
      aria-label="API keys"
      className="glass-panel bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-6"
    >
      <h2 className="text-xl font-bold">API keys</h2>
      {providers.map(provider => {
        const task = tasks.generation.provider === provider ? 'generation' : 'chat'
        const configured = config?.key_configured ?? config?.api_key_configured
        const status =
          provider === generationProvider
            ? configured
              ? statuses[config.key_source] || 'Status shown after saving'
              : 'Not set'
            : 'Status shown after saving'
        return (
          <ProviderKeyRow
            key={provider}
            provider={provider}
            task={task}
            model={tasks[task].model}
            status={status}
            error={errors[provider]}
            onSaved={onSaved}
            onClearError={onClearError}
          />
        )
      })}
    </section>
  )
}
