import ProgressOverview from '../components/ProgressOverview'
import { displayIcon } from '../utils/displayIcon'
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, FileText, Network, Layers, Loader2, Flame, ArrowUpRight } from 'lucide-react'
import { notebooksAPI, progressAPI } from '../services/api'

/**
 * The home screen: one card per topic.
 *
 * A notebook holds its sources and everything made from them, so this is the
 * only place the app starts from. Upload, canvases and decks live inside one.
 */

const ICONS = ['📘', '🧠', '⚙️', '🔬', '🗺️', '📊', '🧩', '🏛️', '💡', '🧪', '📐', '🔐']

export default function Notebooks() {
  const navigate = useNavigate()
  const { hash } = useLocation()
  const [notebooks, setNotebooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(ICONS[0])
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState({})

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

  // Progress is a separate request so a slow or failing stats query still
  // leaves the notebook list usable. The cards simply omit their progress row.
  const loadProgress = async () => {
    try {
      const { data } = await progressAPI.getStatsByNotebook()
      setProgress(Object.fromEntries(data.map((row) => [row.notebook_id, row])))
    } catch {
      setProgress({})
    }
  }

  useEffect(() => {
    load()
    loadProgress()
  }, [])

  useEffect(() => {
    if (!loading && hash === '#progress') document.getElementById('progress')?.scrollIntoView?.()
  }, [hash, loading])

  const due = Object.values(progress).reduce((total, row) => total + (row.questions_due || 0), 0)

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
        <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-300" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your study space</p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Notebooks</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            A place for every curiosity. Keep your sources, diagrams and practice together.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="btn-primary flex items-center gap-2"
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
          className="glass-panel mb-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
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

      {due > 0 && <section aria-label="Review due" className="card mb-6">
        <h2 className="text-xl font-bold">Review due</h2>
        <p>{due} questions due</p>
        <button className="btn-primary mt-3" onClick={() => navigate('/review')}>Review due</button>
      </section>}

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
              className="glass-panel notebook-card flex flex-col gap-3 text-left"
              
            >
              <ArrowUpRight size={19} className="notebook-arrow" aria-hidden="true" />
              <span className="notebook-icon text-3xl" aria-hidden="true">
                {displayIcon(notebook.icon)}
              </span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">{notebook.name}</span>
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

              <NotebookProgress stats={progress[notebook.id]} />
            </button>
          ))}
        </div>
      )}
      <section id="progress" aria-label="Progress" className="mt-8">
        <ProgressOverview notebookStats={Object.values(progress)} />
      </section>
    </div>
  )
}

/**
 * The progress strip on a notebook card.
 *
 * Answers "where do I stand on this subject" at a glance. Overall figures
 * across every notebook appear below the notebook grid.
 */
function NotebookProgress({ stats }) {
  // No stats row yet, or a notebook holding no questions: show nothing rather
  // than a row of zeroes that reads like a failure.
  if (!stats || stats.total_questions === 0) return null

  const masteryPercent = Math.round(stats.mastery_rate * 100)

  return (
    <span className="mt-3 block border-t border-gray-100 pt-3 dark:border-gray-700">
      <span className="flex items-center justify-between text-xs">
        <span className="text-gray-600 dark:text-gray-400">
          {stats.questions_mastered} of {stats.total_questions} mastered
        </span>
        <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
          {masteryPercent}%
        </span>
      </span>

      <span
        className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
        role="progressbar"
        aria-valuenow={masteryPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${masteryPercent}% mastered`}
      >
        <span
          className="block h-full rounded-full bg-primary-600 transition-[width] duration-500"
          style={{ width: `${masteryPercent}%` }}
        />
      </span>

      <span className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        {stats.questions_due > 0 ? (
          <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
            <Flame size={13} /> {stats.questions_due} due
          </span>
        ) : (
          <span className="text-gray-500 dark:text-gray-400">Nothing due</span>
        )}
        <span className="text-gray-500 dark:text-gray-400">{describeLastStudied(stats.last_studied)}</span>
      </span>
    </span>
  )
}

function describeLastStudied(value) {
  if (!value) return 'Not started'

  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000)
  if (days <= 0) return 'Studied today'
  if (days === 1) return 'Studied yesterday'
  if (days < 30) return `Studied ${days} days ago`
  return 'Studied over a month ago'
}
