import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Key, CheckCircle, AlertCircle, Info } from 'lucide-react'
import axios from 'axios'

export default function Settings() {
  const [provider, setProvider] = useState('openai')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState(null)
  const [currentConfig, setCurrentConfig] = useState(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const response = await axios.get('/api/settings/ai-config')
      setCurrentConfig(response.data)
      if (response.data.provider) {
        setProvider(response.data.provider)
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter an API key' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const response = await axios.post('/api/settings/ai-config', {
        provider,
        api_key: apiKey
      })

      setMessage({ type: 'success', text: response.data.message })
      setApiKey('') // Clear the input for security
      loadConfig() // Reload to show preview
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to save configuration'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setMessage(null)

    try {
      const response = await axios.post('/api/settings/ai-config/test')
      setMessage({ type: 'success', text: response.data.message })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to test connection'
      })
    } finally {
      setTesting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete your AI configuration?')) {
      return
    }

    try {
      await axios.delete('/api/settings/ai-config')
      setMessage({ type: 'success', text: 'Configuration deleted successfully' })
      setApiKey('')
      loadConfig()
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete configuration' })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-primary-600" />
          Settings
        </h1>
        <p className="mt-2 text-gray-600">Configure your AI provider for question generation</p>
      </div>

      {/* Current Configuration */}
      {currentConfig?.api_key_configured && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900">Configuration Active</h3>
              <p className="text-sm text-green-800 mt-1">
                Provider: <span className="font-mono">{currentConfig.provider}</span>
              </p>
              <p className="text-sm text-green-800">
                API Key: <span className="font-mono">{currentConfig.api_key_preview}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">AI Provider Configuration</h2>

        {/* Provider Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            AI Provider
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="openai">OpenAI (GPT-4)</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="gemini">Google (Gemini)</option>
          </select>
        </div>

        {/* API Key Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API Key
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Key className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                provider === 'openai' ? 'sk-...' :
                provider === 'anthropic' ? 'sk-ant-...' :
                'AIza...'
              }
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {provider === 'openai' ? 'Get your API key from https://platform.openai.com/api-keys' :
             provider === 'anthropic' ? 'Get your API key from https://console.anthropic.com/' :
             'Get your API key from https://aistudio.google.com/app/apikey'}
          </p>
        </div>

        {/* Info Box */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Your API key is stored securely</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Keys are stored encrypted in the database</li>
                <li>Never shared or sent to external services</li>
                <li>Only used for generating questions from your documents</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          {currentConfig?.api_key_configured && (
            <>
              <button
                onClick={handleTest}
                disabled={testing}
                className="px-6 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`rounded-lg p-4 ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start gap-3">
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <p className={`text-sm ${
              message.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}>
              {message.text}
            </p>
          </div>
        </div>
      )}

      {/* Getting Started Guide */}
      {!currentConfig?.api_key_configured && (
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Getting Started</h3>
          <ol className="space-y-3 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
                1
              </span>
              <span>Choose your preferred AI provider (OpenAI, Anthropic, or Google Gemini)</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
                2
              </span>
              <span>Sign up for an API key from the provider's website</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
                3
              </span>
              <span>Paste your API key above and click "Save Configuration"</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
                4
              </span>
              <span>Start uploading documents and generating questions!</span>
            </li>
          </ol>
        </div>
      )}
    </div>
  )
}
