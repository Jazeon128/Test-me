import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Key, CheckCircle, AlertCircle, Info, Server, Cpu, DollarSign, Zap } from 'lucide-react'
import axios from 'axios'

export default function Settings() {
  const [activeTab, setActiveTab] = useState('api')
  const [provider, setProvider] = useState('openai')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [availableModels, setAvailableModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState(null)
  const [currentConfig, setCurrentConfig] = useState(null)

  useEffect(() => {
    loadConfig()
    loadModels()
  }, [])

  // Update model selection when provider changes
  useEffect(() => {
    if (availableModels.length > 0) {
      const providerModels = availableModels.filter(m => m.provider === provider)
      if (providerModels.length > 0 && !providerModels.find(m => m.id === model)) {
        setModel(providerModels[0].id)
      }
    }
  }, [provider, availableModels])

  const loadModels = async () => {
    try {
      const response = await axios.get('/api/settings/ai-config/models')
      setAvailableModels(response.data)
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  }

  const loadConfig = async () => {
    try {
      const response = await axios.get('/api/settings/ai-config')
      setCurrentConfig(response.data)
      if (response.data.provider) {
        setProvider(response.data.provider)
      }
      if (response.data.model) {
        setModel(response.data.model)
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!apiKey.trim() && !currentConfig?.api_key_configured) {
      setMessage({ type: 'error', text: 'Please enter an API key' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const payload = {
        provider,
        api_key: apiKey || currentConfig?.api_key_preview, // Use existing key if not changed (this logic needs backend support or re-entry)
        model
      }

      // If user hasn't entered a new key, we need to handle that. 
      // For now, require key if not configured, or if changing providers.
      // Ideally backend should handle "keep existing key" logic.
      // Let's assume user must re-enter key if changing provider.
      if (!apiKey && currentConfig?.api_key_configured && provider === currentConfig.provider) {
        // If provider is same and no new key, we might need a way to tell backend to keep it.
        // But our backend expects api_key. 
        // For security, let's require re-entry if they want to change settings, 
        // OR we can just send the model update if key is empty?
        // Let's simplify: if key is empty and we have config, assume we just want to update model?
        // The backend currently validates API key length.
        // Let's ask user to re-enter key for now to be safe/simple.
        if (!apiKey) {
          setMessage({ type: 'error', text: 'Please re-enter your API key to save changes' })
          setSaving(false)
          return
        }
      }

      const response = await axios.post('/api/settings/ai-config', {
        provider,
        api_key: apiKey,
        model
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
      setProvider('openai')
      setModel('')
      loadConfig()
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete configuration' })
    }
  }

  const getSelectedModelDetails = () => {
    return availableModels.find(m => m.id === model)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const selectedModel = getSelectedModelDetails()

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-primary-600 dark:text-primary-400" />
          Settings
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Configure your AI provider and application preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab('api')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'api'
              ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
          API Configuration
        </button>
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'general'
              ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
          General
        </button>
      </div>

      {activeTab === 'api' ? (
        <div className="space-y-6">
          {/* Configuration Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Server className="h-5 w-5 text-primary-500" />
                Provider Settings
              </h2>

              {/* Provider Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </div>

              {/* API Key Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {provider === 'gemini' ? 'Gemini API Key' : `${provider.charAt(0).toUpperCase() + provider.slice(1)} API Key`}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={currentConfig?.api_key_configured && provider === currentConfig.provider ? '••••••••••••••••' : 'Enter your API key'}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  This key is stored locally and only used to make API requests.
                </p>
              </div>

              {/* Model Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                >
                  {availableModels
                    .filter(m => m.provider === provider)
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Model Details */}
              {selectedModel && (
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Capabilities</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Supports images, browser use</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Zap className="h-5 w-5 text-yellow-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Context Window</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{selectedModel.context_window.toLocaleString()} tokens</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <DollarSign className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Input Price</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">${selectedModel.input_price.toFixed(2)} / million tokens</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <DollarSign className="h-5 w-5 text-purple-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Output Price</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">${selectedModel.output_price.toFixed(2)} / million tokens</p>
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

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-primary-600 text-white px-6 py-2.5 rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium shadow-sm shadow-primary-500/30"
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
                {currentConfig?.api_key_configured && (
                  <>
                    <button
                      onClick={handleTest}
                      disabled={testing}
                      className="px-6 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
                    >
                      {testing ? 'Testing...' : 'Test Connection'}
                    </button>
                    <button
                      onClick={handleDelete}
                      className="px-6 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition font-medium"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Message Display */}
          {message && (
            <div className={`rounded-lg p-4 border ${message.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
                : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
              }`}>
              <div className="flex items-start gap-3">
                {message.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <SettingsIcon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">General Settings</h3>
          <p className="text-gray-500 dark:text-gray-400">
            More application settings coming soon.
          </p>
        </div>
      )}
    </div>
  )
}
