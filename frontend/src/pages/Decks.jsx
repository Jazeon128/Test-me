import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { decksAPI, testsAPI } from '../services/api'
import { BookOpen, Trash2, Download, Plus, FileText, X, Upload } from 'lucide-react'

export default function Decks() {
  const navigate = useNavigate()
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [newDeckDescription, setNewDeckDescription] = useState('')
  const [importFile, setImportFile] = useState(null)

  useEffect(() => {
    loadDecks()
  }, [])

  const loadDecks = async () => {
    try {
      const response = await decksAPI.list()
      setDecks(response.data)
    } catch (error) {
      console.error('Failed to load decks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) return

    try {
      await decksAPI.create({
        name: newDeckName,
        description: newDeckDescription,
      })
      setNewDeckName('')
      setNewDeckDescription('')
      setShowCreateModal(false)
      loadDecks()
    } catch (error) {
      alert('Failed to create deck')
    }
  }

  const handleImportDeck = async () => {
    if (!importFile) return

    const formData = new FormData()
    formData.append('file', importFile)

    setLoading(true)
    try {
      await decksAPI.importCSV(formData)
      setImportFile(null)
      setShowImportModal(false)
      loadDecks()
    } catch (error) {
      alert('Failed to import deck')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this deck? Questions will not be deleted.')) {
      return
    }

    try {
      await decksAPI.delete(id)
      setDecks(decks.filter(deck => deck.id !== id))
    } catch (error) {
      alert('Failed to delete deck')
    }
  }

  const handleExportAnki = async (deckId, deckName) => {
    try {
      const response = await testsAPI.exportAnki(deckId)

      // Download the file
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${deckName.replace(/[^a-z0-9]/gi, '_')}.apkg`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      alert('Failed to export to Anki')
      console.error(error)
    }
  }

  const handleExportCSV = async (deckId, deckName) => {
    try {
      const response = await testsAPI.exportCSV(deckId)

      // Download the file
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${deckName.replace(/[^a-z0-9]/gi, '_')}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      alert('Failed to export to CSV')
      console.error(error)
    }
  }

  const handleExportAnkiCSV = async (deckId, deckName) => {
    try {
      const response = await testsAPI.exportAnkiCSV(deckId)

      // Download the file
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${deckName.replace(/[^a-z0-9]/gi, '_')}_AllInOne.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      alert('Failed to export to Anki CSV')
      console.error(error)
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
    <div className="max-w-6xl mx-auto px-4 pb-12">
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Build your knowledge</p>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary-700 to-primary-500">
            Your decks
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Manage your collections and export to Anki or CSV.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Upload size={20} />
            Import
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Plus size={20} />
            New deck
          </button>
          <button
            onClick={() => navigate('/upload')}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Add material
          </button>
        </div>
      </div>

      {decks.length === 0 ? (
        <div className="glass-panel text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <div className="bg-primary-50 dark:bg-primary-900/30 p-4 rounded-full inline-flex mb-4">
            <BookOpen className="h-10 w-10 text-primary-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No decks yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Get started by uploading documents to automatically generate flashcards, or create an empty deck manually.
          </p>
          <button
            onClick={() => navigate('/upload')}
            className="btn-primary"
          >
            Add material
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {decks.map((deck) => (
            <div key={deck.id} className="card group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-xl group-hover:bg-primary-100 transition-colors">
                  <BookOpen className="h-8 w-8 text-primary-600 dark:text-primary-300" />
                </div>
                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {deck.num_questions} cards
                </span>
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 truncate">
                {deck.name}
              </h3>
              {deck.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 line-clamp-2 flex-grow">
                  {deck.description}
                </p>
              )}
              {!deck.description && <div className="flex-grow"></div>}

              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => navigate(`/decks/${deck.id}`)}
                  className="flex-1 btn-primary py-2 text-sm flex items-center justify-center gap-2"
                >
                  <BookOpen size={16} />
                  Open
                </button>

                {deck.num_questions > 0 && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleExportAnki(deck.id, deck.name)}
                      className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                      title="Export to Anki (.apkg)"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      onClick={() => handleExportAnkiCSV(deck.id, deck.name)}
                      className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                      title="Export to Anki (All-In-One CSV)"
                    >
                      <FileText size={18} />
                    </button>
                    <button
                      onClick={() => handleExportCSV(deck.id, deck.name)}
                      className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                      title="Export to Standard CSV"
                    >
                      <FileText size={18} className="opacity-50" />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => handleDelete(deck.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition ml-1"
                  title="Delete Deck"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )
      }

      {/* Create Deck Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-panel bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create new deck</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Deck Name
                </label>
                <input
                  type="text"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  className="input-field dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  placeholder="e.g., Biology Chapter 5"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newDeckDescription}
                  onChange={(e) => setNewDeckDescription(e.target.value)}
                  className="input-field resize-none dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  rows="3"
                  placeholder="What's in this deck?"
                />
              </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 flex gap-3 justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 font-medium hover:text-gray-900 dark:hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDeck}
                className="btn-primary px-6 py-2"
                disabled={!newDeckName.trim()}
              >
                Create Deck
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Deck Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-panel bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Import deck</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
                <p className="font-bold mb-1">CSV format:</p>
                <p>Row 1: Front of card</p>
                <p>Row 2: Back of card</p>
                <p className="mt-2 text-xs opacity-80">No header row required.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files[0])}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary-50 file:text-primary-700
                    hover:file:bg-primary-100
                    dark:file:bg-primary-900/20 dark:file:text-primary-300
                  "
                />
              </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 flex gap-3 justify-end">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 font-medium hover:text-gray-900 dark:hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleImportDeck}
                className="btn-primary px-6 py-2"
                disabled={!importFile || loading}
              >
                {loading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
