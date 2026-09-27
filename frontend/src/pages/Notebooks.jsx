import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Network, Layers, Loader2 } from 'lucide-react'
import { notebooksAPI } from '../services/api'

/**
 * The home screen: one card per topic.
 *
 * A notebook holds its sources and everything made from them, so this is the
 * only place the app starts from. Upload, canvases and decks live inside one.
 */

const ICONS = ['📘', '🧠', '⚙️', '🔬', '🗺️', '📊', '🧩', '🏛️', '💡', '🧪', '📐', '🔐']

export default function Notebooks() {
  const navigate = useNavigate()
  const [notebooks, setNotebooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(ICONS[0])
  const [error, setError] = useState(null)

  const load = async () => {
    try {
      const { data } = await notebooksAPI.list()
      setNotebooks(data)
    } catch {
      setError('Could not load your notebooks.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const create = async (event) => {
    event.preventDefault()
    if (!name.trim()) return
    try {
      const { data } = await notebooksAPI.create({ name: name.trim(), icon })
      setName('')
      setCreating(false)
      navigate(`/notebooks/${data.id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create that notebook.')
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Notebooks</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            One per topic. Each holds its sources, its diagrams and its practice.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-white transition hover:bg-primary-700"
          style={{ minHeight: 44 }}
        >
          <Plus size={18} />
          New notebook
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {creating && (
        <form
          onSubmit={create}
          className="mb-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
        >
          <label
            htmlFor="notebook-name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            What is this notebook about?
          </label>
          <input
            id="notebook-name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="AWS GenAI certification"
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            style={{ minHeight: 44 }}
          />

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Icon</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {ICONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setIcon(option)}
                  aria-label={`Use the ${option} icon`}
                  aria-pressed={icon === option}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg border text-xl transition ${
                    icon === option
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-white disabled:opacity-50"
              style={{ minHeight: 44 }}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 dark:border-gray-600 dark:text-gray-300"
              style={{ minHeight: 44 }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {notebooks.length === 0 && !creating ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
          <p className="font-medium text-gray-900 dark:text-white">No notebooks yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
            A notebook is one subject you are studying. Make one, add the documents it covers,
            and the app will build diagrams and questions from them.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notebooks.map((notebook) => (
            <button
              key={notebook.id}
              type="button"
              onClick={() => navigate(`/notebooks/${notebook.id}`)}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 text-left transition hover:border-primary-400 dark:border-gray-700 dark:bg-gray-800"
              style={{ minHeight: 148 }}
            >
              <span className="text-3xl" aria-hidden="true">
                {notebook.icon || '📘'}
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">{notebook.name}</span>
              {notebook.description && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {notebook.description}
                </span>
              )}
              <span className="mt-auto flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <FileText size={13} /> {notebook.sources} sources
                </span>
                <span className="flex items-center gap-1">
                  <Network size={13} /> {notebook.canvases} canvases
                </span>
                <span className="flex items-center gap-1">
                  <Layers size={13} /> {notebook.decks} decks
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
