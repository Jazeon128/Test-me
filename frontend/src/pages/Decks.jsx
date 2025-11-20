import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { decksAPI, testsAPI } from '../services/api'
import { BookOpen, Trash2, Download, Play, Edit2, Plus, FileText, X } from 'lucide-react'

export default function Decks() {
  const navigate = useNavigate()
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [newDeckDescription, setNewDeckDescription] = useState('')

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
          <h1 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary-700 to-primary-500">
            Question Decks
          </h1>
          <p className="text-lg text-gray-600">
            Manage your collections and export to Anki or CSV.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Plus size={20} />
            New Deck
          </button>
          <button
            onClick={() => navigate('/upload')}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Upload Documents
          </button>
        </div>
      </div>

      {decks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <div className="bg-primary-50 p-4 rounded-full inline-flex mb-4">
            <BookOpen className="h-10 w-10 text-primary-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No decks yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Get started by uploading documents to automatically generate flashcards, or create an empty deck manually.
          </p>
          <button
            onClick={() => navigate('/upload')}
            className="btn-primary"
          >
            Upload Documents
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {decks.map((deck) => (
            <div key={deck.id} className="card group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-primary-50 rounded-xl group-hover:bg-primary-100 transition-colors">
                  <BookOpen className="h-8 w-8 text-primary-600" />
                </div>
                <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-600">
                  {deck.num_questions} cards
                </span>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2 truncate">
                {deck.name}
              </h3>
              {deck.description && (
                <p className="text-sm text-gray-500 mb-6 line-clamp-2 flex-grow">
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
                      className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                      title="Export to Anki (.apkg)"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      onClick={() => handleExportAnkiCSV(deck.id, deck.name)}
                      className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                      title="Export to Anki (All-In-One CSV)"
                    >
                      <FileText size={18} />
                    </button>
                    <button
                      onClick={() => handleExportCSV(deck.id, deck.name)}
                      className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
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
      {
        showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slide-up">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Create New Deck</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deck Name
                  </label>
                  <input
                    type="text"
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                    className="input-field"
                    placeholder="e.g., Biology Chapter 5"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={newDeckDescription}
                    onChange={(e) => setNewDeckDescription(e.target.value)}
                    className="input-field resize-none"
                    rows="3"
                    placeholder="What's in this deck?"
                  />
                </div>
              </div>

              <div className="p-6 bg-gray-50 flex gap-3 justify-end">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 font-medium hover:text-gray-900 transition"
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
        )
      }
    </div >
  )
}
