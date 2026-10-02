import { useEffect, useRef, useState } from 'react'
import { CheckCircle, Zap, DollarSign } from 'lucide-react'
import api from '../../services/api'
import { serverMessage } from '../../utils/serverMessage'
import ModelSelector from '../ModelSelector'
import OpenRouterModelPicker from '../OpenRouterModelPicker'

export default function TaskModelCard({
  task,
  value,
  onChange,
  availableModels,
  catalog,
  onReloadCatalog,
  onSaved,
  onKeyError,
  keyConfigured,
  onDeleted,
}) {
  const title = task === 'generation' ? 'Question generation' : 'Chat'
  const { provider, model } = value
  const [isCustom, setIsCustom] = useState(false)
  const [valid, setValid] = useState(true)
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState(null)
  const initialized = useRef(false)
  const providerModels = availableModels.filter(item => item.provider === provider)
  const selectedModel = providerModels.find(item => item.id === model)

  useEffect(() => {
    if (initialized.current || !availableModels.length || provider === 'openrouter') return
    initialized.current = true
    setIsCustom(
      Boolean(model) &&
        !availableModels.some(item => item.provider === provider && item.id === model)
    )
    if (!model)
      onChange({
        provider,
        model: availableModels.find(item => item.provider === provider)?.id || '',
      })
  }, [availableModels, model, provider, onChange])

  const save = async () => {
    if (!valid || !model.trim()) {
      setMessage({ type: 'error', text: 'Please enter a valid model name' })
      return
    }
    setBusy('save')
    setMessage(null)
    onKeyError(provider, null)
    try {
      const { data } = await api.post('/settings/ai-config', { provider, model, task })
      setMessage({
        type: 'success',
        text: isCustom
          ? `Configuration saved successfully! Custom model "${model}" will be used for ${task === 'generation' ? 'question generation' : 'chat'}.`
          : data.message || 'Configuration saved successfully',
      })
      await onSaved()
    } catch (error) {
      const text = serverMessage(error.originalError || error) || 'Failed to save configuration'
      const status = error.status || (error.originalError || error).response?.status
      if (status === 400 && /^No .+ API key/i.test(text)) onKeyError(provider, text)
      else setMessage({ type: 'error', text })
    } finally {
      setBusy(null)
    }
  }

  const test = async () => {
    setBusy('test')
    setMessage(null)
    try {
      const { data } = await api.post('/settings/ai-config/test')
      setMessage({ type: 'success', text: data.message })
    } catch (error) {
      setMessage({
        type: 'error',
        text: serverMessage(error.originalError || error) || 'Failed to test connection',
      })
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!confirm('Are you sure you want to delete your AI configuration?')) return
    try {
      await api.delete('/settings/ai-config')
      setMessage({ type: 'success', text: 'Configuration deleted successfully' })
      initialized.current = false
      await onDeleted()
    } catch (error) {
      setMessage({
        type: 'error',
        text: serverMessage(error.originalError || error) || 'Failed to delete configuration',
      })
    }
  }

  return (
    <section
      aria-label={title}
      className="glass-panel bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4"
    >
      <h2 className="text-xl font-bold">{title}</h2>
      <label htmlFor={`${task}-provider`} className="block">
        API Provider
      </label>
      <select
        id={`${task}-provider`}
        value={provider}
        className="w-full p-3 rounded-lg border bg-white dark:bg-gray-900"
        onChange={event => {
          const provider = event.target.value
          initialized.current = true
          setIsCustom(false)
          setValid(true)
          setMessage(null)
          onChange({
            provider,
            model: availableModels.find(item => item.provider === provider)?.id || '',
          })
        }}
      >
        <option value="anthropic">Anthropic</option>
        <option value="openai">OpenAI</option>
        <option value="gemini">Gemini</option>
        <option value="openrouter">OpenRouter</option>
      </select>
      {provider === 'openrouter' ? (
        <OpenRouterModelPicker
          selectedModel={model}
          onModelChange={model => onChange({ provider, model })}
          catalog={catalog}
          onReload={onReloadCatalog}
          label={`${title} OpenRouter models`}
        />
      ) : (
        <ModelSelector
          key={provider}
          provider={provider}
          selectedModel={model}
          availableModels={providerModels}
          onModelChange={model => onChange({ provider, model })}
          isCustom={isCustom}
          onToggleCustom={() => {
            initialized.current = true
            setIsCustom(previous => !previous)
          }}
          onValidationChange={setValid}
        />
      )}
      {/* Model Details - Only show for predefined models */}
      {selectedModel && !isCustom && (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Capabilities</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Supports images, browser use
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Context Window</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedModel.context_window.toLocaleString()} tokens
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Input Price</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  ${selectedModel.input_price.toFixed(2)} / million tokens
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-purple-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Output Price</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  ${selectedModel.output_price.toFixed(2)} / million tokens
                </p>
              </div>
            </div>
          </div>
          {selectedModel.description && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                {selectedModel.description}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={Boolean(busy)}
          className="btn-primary"
        >
          {busy === 'save' ? 'Saving...' : 'Save Configuration'}
        </button>
        {task === 'generation' && keyConfigured && (
          <>
            <button className="btn-secondary" onClick={test} disabled={Boolean(busy)}>
              {busy === 'test' ? 'Testing...' : 'Test Connection'}
            </button>
            <button className="btn-danger" style={{ marginLeft: 'auto' }} onClick={remove}>Delete</button>
          </>
        )}
      </div>
      {message && (
        <div
          role="alert"
          aria-live="polite"
          className={`rounded-lg p-4 border ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
        >
          <p>{message.text}</p>
          {isCustom && message.type === 'success' && (
            <p>
              Note: Custom models are sent directly to the provider without validation. If you
              encounter errors, please verify the model name is correct.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
