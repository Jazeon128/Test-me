import { useState, useEffect } from 'react'
import { X, Key, Check, AlertCircle, Eye, EyeOff } from 'lucide-react'

/**
 * SettingsDialog Component
 * Provides UI for configuring API keys for different AI providers
 * Implements Requirements 4.1: Settings dialog for API key configuration
 */
export default function SettingsDialog({ isOpen, onClose }) {
  const [provider, setProvider] = useState('openai')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [, setCurrentSettings] = useState(null)

  // Load current settings when dialog opens
  useEffect(() => {
    if (isOpen && window.electronAPI) {
      loadSettings()
    }
  }, [isOpen])

  const loadSettings = async () => {
    try {
      const response = await window.electronAPI.getSettings()
      if (response.success) {
        setCurrentSettings(response.data)
        // Set default provider if one is configured
        if (response.data.apiProvider) {
          setProvider(response.data.apiProvider)
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const validateApiKey = (key, providerType) => {
    if (!key || key.trim() === '') {
      return 'API key cannot be empty'
    }

    // Basic format validation
    switch (providerType) {
      case 'openai':
        if (!key.startsWith('sk-')) {
          return 'OpenAI API keys should start with "sk-"'
        }
        if (key.length < 20) {
          return 'OpenAI API key appears to be too short'
        }
        break
      case 'anthropic':
        if (!key.startsWith('sk-ant-')) {
          return 'Anthropic API keys should start with "sk-ant-"'
        }
        if (key.length < 20) {
          return 'Anthropic API key appears to be too short'
        }
        break
      case 'google':
        if (key.length < 20) {
          return 'Google API key appears to be too short'
        }
        break
      default:
        return 'Invalid provider selected'
    }

    return null
  }

  const handleSave = async () => {
    setValidationError('')
    setSuccessMessage('')

    // Validate the API key
    const error = validateApiKey(apiKey, provider)
    if (error) {
      setValidationError(error)
      return
    }

    setIsSaving(true)

    try {
      // Save API key
      const keyResponse = await window.electronAPI.setApiKey(provider, apiKey)
      
      if (!keyResponse.success) {
        setValidationError(keyResponse.error || 'Failed to save API key')
        setIsSaving(false)
        return
      }

      // Save provider preference
      const providerResponse = await window.electronAPI.setSetting('apiProvider', provider)
      
      if (!providerResponse.success) {
        setValidationError(providerResponse.error || 'Failed to save provider preference')
        setIsSaving(false)
        return
      }

      setSuccessMessage('API key saved successfully!')
      setApiKey('')
      
      // Close dialog after a short delay
      setTimeout(() => {
        onClose()
        setSuccessMessage('')
      }, 1500)
    } catch (error) {
      setValidationError(error.message || 'An unexpected error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setApiKey('')
    setValidationError('')
    setSuccessMessage('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 glass-floating animate-fade-in">
      <div className="glass-floating bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 dark:bg-primary-900/30 p-2 rounded-lg">
              <Key className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              API key configuration
            </h2>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AI Provider
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setProvider('openai')}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  provider === 'openai'
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                OpenAI
              </button>
              <button
                onClick={() => setProvider('anthropic')}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  provider === 'anthropic'
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Anthropic
              </button>
              <button
                onClick={() => setProvider('google')}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  provider === 'google'
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Google
              </button>
            </div>
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setValidationError('')
                }}
                placeholder={`Enter your ${provider} API key`}
                className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Your API key is stored securely and never shared.
            </p>
          </div>

          {/* Validation Error */}
          {validationError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{validationError}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !apiKey}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isSaving ? 'Saving...' : 'Save API Key'}
          </button>
        </div>
      </div>
    </div>
  )
}
