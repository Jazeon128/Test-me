import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { decksAPI, testsAPI } from '../services/api'
import { BookOpen, Trash2, Download, Play, Edit2, Plus, FileText } from 'lucide-react'

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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Question Decks</h1>
          <p className="mt-2 text-gray-600">Manage your question collections and export to Anki or CSV</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
          >
            <Plus size={20} />
            New Deck
          </button>
          <button
            onClick={() => navigate('/upload')}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
          >
            Upload Documents
          </button>
        </div>
      </div>

      {decks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No decks yet</h3>
          <p className="text-gray-600 mb-4">Upload documents to create your first deck</p>
          <button
            onClick={() => navigate('/upload')}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
          >
            Upload Documents
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {decks.map((deck) => (
            <div key={deck.id} className="bg-white rounded-lg shadow hover:shadow-lg transition p-6">
              <div className="flex items-start justify-between mb-4">
                <BookOpen className="h-10 w-10 text-primary-600" />
                <span className="px-2 py-1 bg-primary-100 rounded text-xs text-primary-700 font-semibold">
                  {deck.num_questions} questions
                </span>
              </div>

              <h3 className="font-semibold text-gray-900 mb-1 truncate">
                {deck.name}
              </h3>
              {deck.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {deck.description}
                </p>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => navigate(`/decks/${deck.id}`)}
                  className="flex-1 bg-primary-600 text-white px-3 py-2 rounded-lg hover:bg-primary-700 transition text-sm flex items-center justify-center gap-2"
                >
                  <BookOpen size={16} />
                  Open Deck
                </button>
                {deck.num_questions > 0 && (
                  <>
                    <button
                      onClick={() => handleExportAnki(deck.id, deck.name)}
                      className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
                      title="Export as .apkg (Anki)"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => handleExportCSV(deck.id, deck.name)}
                      className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                      title="Export as CSV"
                    >
                      <FileText size={16} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDelete(deck.id)}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Deck Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create New Deck</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deck Name
                </label>
                <input
                  type="text"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., Biology Chapter 5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newDeckDescription}
                  onChange={(e) => setNewDeckDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows="3"
                  placeholder="What's in this deck?"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDeck}
                className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
                disabled={!newDeckName.trim()}
              >
                Create Deck
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
