import Spinner from '../components/Spinner'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Settings as SettingsIcon, Monitor, Sun, Moon } from 'lucide-react'
import api from '../services/api'
import { useTheme } from '../context/useTheme'
import TypeSafeKeyCard from '../components/TypeSafeKeyCard'
import TaskModelCard from '../components/settings/TaskModelCard'
import ProviderKeys from '../components/settings/ProviderKeys'
import { serverMessage } from '../utils/serverMessage'

export default function Settings() {
  const [activeTab, setActiveTab] = useState('api')
  const [tasks, setTasks] = useState(null)
  const [currentConfig, setCurrentConfig] = useState(null)
  const [availableModels, setAvailableModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [keyErrors, setKeyErrors] = useState({})
  const [catalog, setCatalog] = useState({ loading: true, models: [] })
  const catalogRequested = useRef(false)
  const [balance, setBalance] = useState(null)
  const [balanceRevision, setBalanceRevision] = useState(0)
  const { theme, setTheme } = useTheme()

  const loadConfig = useCallback(async (initialize = false) => {
    try {
      const { data } = await api.get('/settings/ai-config')
      setCurrentConfig(data)
      if (initialize) {
        setTasks({
          generation: {
            provider: data.generation_provider || data.provider || 'openai',
            model: data.generation_model || data.model || '',
          },
          chat: {
            provider: data.chat_provider || data.provider || 'openai',
            model: data.chat_model || data.model || '',
          },
        })
      }
      setBalanceRevision(value => value + 1)
    } catch (error) {
      console.error('Failed to load config:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig(true)
    api
      .get('/settings/ai-config/models')
      .then(({ data }) => setAvailableModels(data))
      .catch(error => console.error('Failed to load models:', error))
  }, [loadConfig])

  const usesOpenRouter = Object.values(tasks || {}).some(task => task.provider === 'openrouter')
  const loadCatalog = useCallback(async (refresh = false) => {
    setCatalog(previous => ({ ...previous, loading: true, error: null }))
    try {
      const { data } = await api.get(`/settings/openrouter/models${refresh ? '?refresh=true' : ''}`)
      setCatalog({ ...data, loading: false })
    } catch (error) {
      setCatalog(previous => ({
        ...previous,
        loading: false,
        error: serverMessage(error.originalError || error) || 'Failed to load models',
      }))
    }
  }, [])

  useEffect(() => {
    if (usesOpenRouter && !catalogRequested.current) {
      catalogRequested.current = true
      loadCatalog()
    }
  }, [usesOpenRouter, loadCatalog])

  useEffect(() => {
    if (!usesOpenRouter) return
    let active = true
    api
      .get('/settings/openrouter/key')
      .then(({ data }) => {
        if (active) setBalance(data)
      })
      .catch(() => {
        if (active) setBalance(null)
      })
    return () => {
      active = false
    }
  }, [usesOpenRouter, balanceRevision])

  const updateTask = (task, value) => {
    setTasks(previous => ({ ...previous, [task]: value }))
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner aria-label="Loading settings" className="h-12 w-12" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-primary-600 dark:text-primary-400" />
          Settings
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Configure your AI provider and application preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab('api')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'api'
              ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          API configuration
        </button>
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'general'
              ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          General
        </button>
      </div>

      {activeTab === 'api' ? (
        <div className="space-y-6">
          {tasks &&
            Object.entries(tasks).map(([task, value]) => (
              <TaskModelCard
                key={task}
                task={task}
                value={value}
                onChange={value => updateTask(task, value)}
                availableModels={availableModels}
                catalog={catalog}
                onReloadCatalog={loadCatalog}
                onSaved={loadConfig}
                onKeyError={(provider, message) =>
                  setKeyErrors(previous => ({ ...previous, [provider]: message }))
                }
                keyConfigured={currentConfig?.key_configured ?? currentConfig?.api_key_configured}
                onDeleted={() => loadConfig(true)}
              />
            ))}
          {tasks && (
            <ProviderKeys
              tasks={tasks}
              config={currentConfig}
              errors={keyErrors}
              onSaved={loadConfig}
              onClearError={provider =>
                setKeyErrors(previous => ({ ...previous, [provider]: null }))
              }
            />
          )}
          {usesOpenRouter && balance && (
            <p>
              {balance.limit == null
                ? `No credit limit, $${Number(balance.usage).toFixed(2)} used`
                : `OpenRouter credit: $${Number(balance.limit_remaining).toFixed(2)} of $${Number(balance.limit).toFixed(2)} left`}
            </p>
          )}
          <TypeSafeKeyCard />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="glass-panel bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary-500" />
                Appearance
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setTheme('light')}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
                    theme === 'light'
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <Sun className="h-8 w-8" />
                  <span className="font-medium">Light Mode</span>
                </button>

                <button
                  onClick={() => setTheme('dark')}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
                    theme === 'dark'
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <Moon className="h-8 w-8" />
                  <span className="font-medium">Dark Mode</span>
                </button>

                <button
                  onClick={() => setTheme('system')}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
                    theme === 'system'
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <Monitor className="h-8 w-8" />
                  <span className="font-medium">System Default</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
