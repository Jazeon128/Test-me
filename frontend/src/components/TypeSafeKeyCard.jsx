import { useEffect, useState } from 'react'
import { Key, Server, CheckCircle, AlertCircle } from 'lucide-react'
import api from '../services/api'
import { serverMessage } from '../utils/serverMessage'

const endpoint = '/settings/typesafe'

export default function TypeSafeKeyCard() {
  const [config, setConfig] = useState(null)
  const [unavailable, setUnavailable] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [usage, setUsage] = useState(null)
  const [usageReload, setUsageReload] = useState(0)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data } = await api.get(`${endpoint}/usage?days=30`)
        if (active) setUsage(Array.isArray(data?.features) && data?.totals ? data : null)
      } catch {
        if (active) setUsage(null)
      }
    }
    load()
    return () => { active = false }
  }, [usageReload])

  useEffect(() => {
    let active = true
    api.get(endpoint).then(({ data }) => {
      if (active) setConfig(data)
    }).catch(() => {
      if (active) setUnavailable(true)
    })
    return () => { active = false }
  }, [])

  const perform = async (action) => {
    setBusy(true)
    setMessage(null)
    try {
      let response
      if (action === 'save') {
        response = await api.put(endpoint, { api_key: apiKey.trim() })
        setApiKey('')
      } else if (action === 'remove') {
        response = await api.delete(endpoint)
      } else {
        response = await api.post(`${endpoint}/test`)
        setUsageReload((value) => value + 1)
      }
      if (action !== 'test') {
        setConfig(response.data)
        setUnavailable(false)
      }
      setMessage({ type: 'success', text: response.data.message })
    } catch (error) {
      setMessage({ type: 'error', text: serverMessage(error.originalError || error) || 'TypeSafe request failed. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  let status = 'Not configured'
  if (unavailable) status = 'Status unavailable'
  else if (config?.source === 'settings') status = `Saved in Settings (${config.preview})`
  else if (config?.source === 'environment') status = `Using the key from the backend environment (${config.preview})`

  return (
    <div className="glass-panel bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <Server className="h-5 w-5 text-primary-500" />
          TypeSafe (System One)
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Powers written-answer grading, hints, tag suggestions, duplicate detection and question checks. Without a key these features stay off.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{status}</p>
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Key className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="password"
            aria-label="TypeSafe API key"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Enter your TypeSafe API key"
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => perform('save')}
            disabled={busy || !apiKey.trim()}
            className="flex-1 basis-full sm:basis-auto bg-primary-600 text-white px-6 py-2.5 rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium shadow-sm shadow-primary-500/30"
          >Save TypeSafe key</button>
          {config?.configured && (
            <button
              onClick={() => perform('test')}
              disabled={busy}
              className="px-6 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
            >Test TypeSafe key</button>
          )}
          {config?.source === 'settings' && (
            <button
              onClick={() => perform('remove')}
              disabled={busy}
              className="px-6 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition font-medium"
            >Remove TypeSafe key</button>
          )}
        </div>
        {usage && (
          <section className="mt-6 text-sm text-gray-700 dark:text-gray-300">
            <h3 className="font-semibold mb-3">Usage, last 30 days</h3>
            {usage.features.length === 0 ? <p>No Jev calls yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th scope="col" className="text-left py-2 pr-4">Feature</th>
                      {['Calls', 'Failed', 'Input tokens'].map((heading) => (
                        <th key={heading} scope="col" className="text-right tabular-nums py-2 px-2 whitespace-nowrap">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usage.features.map((feature) => (
                      <tr key={feature.label}>
                        <th scope="row" className="text-left font-normal py-2 pr-4">{feature.label}</th>
                        {[feature.calls, feature.failures, feature.input_tokens].map((number, index) => (
                          <td key={index} className="text-right tabular-nums py-2 px-2">{number.toLocaleString()}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-gray-200 dark:border-gray-700 font-semibold">
                    <tr>
                      <th scope="row" className="text-left py-2 pr-4">Total</th>
                      {[usage.totals.calls, usage.totals.failures, usage.totals.input_tokens].map((number, index) => (
                        <td key={index} className="text-right tabular-nums py-2 px-2">{number.toLocaleString()}</td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        )}
        {message && (
          <div
            role={message.type === 'success' ? 'status' : 'alert'}
            className={`mt-4 rounded-lg p-4 border flex items-start gap-3 ${message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'}`}
          >
            {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}
      </div>
    </div>
  )
}
