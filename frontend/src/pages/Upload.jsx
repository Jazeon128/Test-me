import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { documentsAPI, decksAPI } from '../services/api'
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle, Plus } from 'lucide-react'

export default function Upload() {
  const navigate = useNavigate()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [numQuestions, setNumQuestions] = useState(10)
  const [difficulty, setDifficulty] = useState('mixed')
  const [decks, setDecks] = useState([])
  const [selectedDeck, setSelectedDeck] = useState('new')
  const [newDeckName, setNewDeckName] = useState('')
  const [deckDescription, setDeckDescription] = useState('')
  const [loadingDecks, setLoadingDecks] = useState(true)
  const [regenerate, setRegenerate] = useState(false)

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
      setLoadingDecks(false)
    }
  }

  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return

    const formData = new FormData()
    acceptedFiles.forEach(file => {
      formData.append('files', file)
    })
    formData.append('num_questions', numQuestions)
    formData.append('difficulty', difficulty)

    // Handle deck creation or selection
    if (selectedDeck === 'new') {
      // Deck name is optional - backend will use filename if not provided
      if (newDeckName.trim()) {
        formData.append('deck_name', newDeckName)
      }
      if (deckDescription.trim()) {
        formData.append('deck_description', deckDescription)
      }
    } else {
      formData.append('deck_id', selectedDeck)
    }

    // Add regenerate flag
    formData.append('regenerate', regenerate)

    setUploading(true)
    setError(null)
    setResult(null)

    try {
      const response = await documentsAPI.upload(formData, (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        setUploadProgress(progress)
      })

      setResult(response.data)
      setTimeout(() => {
        navigate(`/decks/${response.data.deck_id}`)
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/html': ['.html', '.htm'],
      'text/markdown': ['.md'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    multiple: true,
    disabled: uploading,
  })

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Upload Document</h1>
        <p className="mt-2 text-gray-600">
          Upload a PDF, HTML, Markdown, or DOCX file to generate questions
        </p>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Generation Settings</h2>

        {/* Deck Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Deck
          </label>
          <select
            value={selectedDeck}
            onChange={(e) => setSelectedDeck(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-2"
            disabled={uploading || loadingDecks}
          >
            <option value="new">➕ Create New Deck</option>
            {decks.length > 0 && <option disabled>───────────────────</option>}
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                📚 {deck.name} ({deck.num_questions} questions)
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {selectedDeck === 'new'
              ? '✨ A new deck will be created for these questions'
              : '📥 Questions will be added to the selected deck'}
          </p>

          {/* New Deck Name Input */}
          {selectedDeck === 'new' && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deck Name (optional)
                </label>
                <input
                  type="text"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder="Leave blank to use filename"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={uploading}
                />
                <p className="mt-1 text-xs text-gray-500">
                  If not provided, the deck will be named after your uploaded file(s)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={deckDescription}
                  onChange={(e) => setDeckDescription(e.target.value)}
                  placeholder="What topics does this deck cover?"
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={uploading}
                />
              </div>
            </div>
          )}
        </div>

        {/* Regenerate Option - Only show when adding to existing deck */}
        {selectedDeck !== 'new' && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={regenerate}
                onChange={(e) => setRegenerate(e.target.checked)}
                className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                disabled={uploading}
              />
              <div>
                <span className="font-medium text-gray-900">Regenerate all questions</span>
                <p className="text-sm text-gray-600 mt-1">
                  Delete existing questions and regenerate them from all documents (old + new) combined.
                  This allows questions to cover material from multiple sources.
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Question Configuration */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Question Configuration</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Questions
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={uploading}
              />
              <p className="text-xs text-gray-500 mt-1">
                How many questions to generate from the uploaded content
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty Level
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={uploading}
              >
                <option value="easy">Easy - Basic Recall</option>
                <option value="medium">Medium - Application</option>
                <option value="hard">Hard - Analysis & Critical Thinking</option>
                <option value="mixed">Mixed - Exam Style</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition
          ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center">
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mb-4"></div>
              <p className="text-lg font-medium text-gray-700">Uploading... {uploadProgress}%</p>
              <p className="text-sm text-gray-500 mt-2">Generating questions in the background</p>
            </>
          ) : (
            <>
              <UploadIcon className="h-16 w-16 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
              </p>
              <p className="text-sm text-gray-500 mb-4">or click to select files (multiple files supported)</p>
              <div className="flex gap-2 flex-wrap justify-center">
                <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">PDF</span>
                <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">HTML</span>
                <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">Markdown</span>
                <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">DOCX</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Success Message */}
      {result && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900">Upload Successful!</h3>
            <p className="text-green-800 text-sm mt-1">{result.message}</p>
            <p className="text-green-700 text-sm mt-2">Redirecting to documents...</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Upload Failed</h3>
            <p className="text-red-800 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}
