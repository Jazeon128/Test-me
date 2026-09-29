import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Network, Layers, Upload, Loader2, Play } from 'lucide-react'
import PropTypes from 'prop-types'

import { notebooksAPI } from '../services/api'

/**
 * One topic: its sources, the diagrams drawn from them, and the practice built
 * on them. Everything in the app that is specific to a subject lives here.
 */

const TABS = [
  { id: 'sources', label: 'Sources', icon: FileText },
  { id: 'canvases', label: 'Canvases', icon: Network },
  { id: 'decks', label: 'Decks', icon: Layers },
]

export default function NotebookDetail() {
  const { notebookId } = useParams()
  const navigate = useNavigate()
  const [notebook, setNotebook] = useState(null)
  const [tab, setTab] = useState('sources')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const { data } = await notebooksAPI.get(notebookId)
      setNotebook(data)
    } catch {
      setError('That notebook could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [notebookId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-300" />
      </div>
    )
  }

  if (error || !notebook) {
    return (
      <div className="mx-auto max-w-4xl px-4">
        <p className="text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      </div>
    )
  }

  const counts = {
    sources: notebook.documents.length,
    canvases: notebook.canvases.length,
    decks: notebook.decks.length,
  }

  return (
    <div className="mx-auto max-w-5xl px-4">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-4 flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft size={18} />
        All notebooks
      </button>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="text-4xl" aria-hidden="true">
            {notebook.icon || '\u{1F4D8}'}
          </span>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{notebook.name}</h1>
            {notebook.description && (
              <p className="mt-1 text-gray-600 dark:text-gray-400">{notebook.description}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/upload?notebook=${notebook.id}`)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-white transition hover:bg-primary-700"
          style={{ minHeight: 44 }}
        >
          <Upload size={18} />
          Add a source
        </button>
      </div>

      <div
        className="mb-6 flex gap-1 border-b border-gray-200 dark:border-gray-700"
        role="tablist"
        aria-label="Notebook contents"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
              tab === id
                ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                : 'border-transparent text-gray-600 dark:text-gray-400'
            }`}
            style={{ minHeight: 44 }}
          >
            <Icon size={16} />
            {label}
            <span className="text-xs text-gray-400">{counts[id]}</span>
          </button>
        ))}
      </div>

      {tab === 'sources' && (
        <Panel
          empty={counts.sources === 0}
          emptyTitle="No sources yet"
          emptyBody="Add a PDF, Word file, slide deck, Markdown file or YouTube link. Everything else in this notebook is built from what you put here."
        >
          {notebook.documents.map((document) => (
            <div key={document.id} className="flex flex-wrap items-center gap-3 p-4">
              <FileText size={18} className="flex-none text-gray-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-900 dark:text-white">
                  {document.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {document.file_type?.toUpperCase()}
                  {document.num_pages ? ` · ${document.num_pages} pages` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/canvas?document=${document.id}`)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 transition hover:border-primary-500 hover:text-primary-700 dark:border-gray-600 dark:text-gray-300"
                style={{ minHeight: 44 }}
              >
                <Network size={15} />
                Explain on a canvas
              </button>
            </div>
          ))}
        </Panel>
      )}

      {tab === 'canvases' && (
        <Panel
          empty={counts.canvases === 0}
          emptyTitle="No canvases yet"
          emptyBody="Open a source and ask it something. The app picks how to draw the answer, and every node traces back to the passage it came from."
        >
          {notebook.canvases.map((canvas) => (
            <button
              key={canvas.id}
              type="button"
              onClick={() => navigate(`/canvas/${canvas.id}`)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <Network size={18} className="flex-none text-gray-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-900 dark:text-white">
                  {canvas.request_text}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {canvas.template}
                  {canvas.routing_confidence != null
                    ? ` · chosen automatically, ${Math.round(canvas.routing_confidence * 100)}% confident`
                    : canvas.chosen_by_user
                      ? ' · you chose this form'
                      : ''}
                </div>
              </div>
            </button>
          ))}
        </Panel>
      )}

      {tab === 'decks' && (
        <Panel
          empty={counts.decks === 0}
          emptyTitle="No decks yet"
          emptyBody="Uploading a source generates questions from it. You can also build a deck from a single canvas node."
        >
          {notebook.decks.map((deck) => (
            <div key={deck.id} className="flex flex-wrap items-center gap-3 p-4">
              <Layers size={18} className="flex-none text-gray-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-900 dark:text-white">
                  {deck.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {deck.num_questions} questions
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/decks/${deck.id}`)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300"
                style={{ minHeight: 44 }}
              >
                Open
              </button>
              {deck.num_questions > 0 && (
                <button
                  type="button"
                  onClick={() => navigate(`/decks/${deck.id}/practice`)}
                  className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm text-white"
                  style={{ minHeight: 44 }}
                >
                  <Play size={15} />
                  Practice
                </button>
              )}
            </div>
          ))}
        </Panel>
      )}
    </div>
  )
}

function Panel({ empty, emptyTitle, emptyBody, children }) {
  if (empty) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
        <p className="font-medium text-gray-900 dark:text-white">{emptyTitle}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
          {emptyBody}
        </p>
      </div>
    )
  }
  return (
    <div className="glass-panel divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
      {children}
    </div>
  )
}

Panel.propTypes = {
  empty: PropTypes.bool,
  emptyTitle: PropTypes.string,
  emptyBody: PropTypes.string,
  children: PropTypes.node,
}
