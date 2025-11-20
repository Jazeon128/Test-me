import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { documentsAPI, decksAPI, statusAPI } from '../services/api'
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle, Plus, Loader2, Book, FileType } from 'lucide-react'

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

  // Generation status tracking
  const [generating, setGenerating] = useState(false)
  const [jobId, setJobId] = useState(null)
  const [generationStatus, setGenerationStatus] = useState(null)
  const [generationLogs, setGenerationLogs] = useState([])
  const [statusCheckInterval, setStatusCheckInterval] = useState(null)

  useEffect(() => {
    loadDecks()
  }, [])

  // Cleanup status polling on unmount
  useEffect(() => {
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval)
      }
    }
  }, [statusCheckInterval])

  // Check generation status
  const checkStatus = async (currentJobId) => {
    try {
      const response = await statusAPI.get(currentJobId)
      const status = response.data

      setGenerationStatus(status)
      setGenerationLogs(status.logs || [])

      if (status.status === 'completed') {
        clearInterval(statusCheckInterval)
        setGenerating(false)
        setResult({
          ...result,
          job_id: currentJobId,
          message: 'Questions generated successfully!'
        })

        // Redirect after a short delay
        setTimeout(() => {
          navigate(`/decks/${status.deck_id}`)
        }, 2000)
      } else if (status.status === 'failed') {
        clearInterval(statusCheckInterval)
        setGenerating(false)
        setError(status.error_message || 'Generation failed')
      }
    } catch (err) {
      console.error('Failed to check status:', err)
    }
  }

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
    formData.append('num_questions', numQuestions || 10)
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

      setUploading(false)
      setResult(response.data)

      // Start generation tracking
      const newJobId = response.data.job_id
      setJobId(newJobId)
      setGenerating(true)
      setGenerationLogs([])
      setGenerationStatus(null)

      // Start polling for status
      const interval = setInterval(() => {
        checkStatus(newJobId)
      }, 2000)
      setStatusCheckInterval(interval)

      // Check immediately
      checkStatus(newJobId)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload document')
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
    <div className="max-w-5xl mx-auto px-4 pb-12">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary-700 to-primary-500">
          Upload Documents
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Transform your study materials into interactive flashcards instantly.
          We support PDF, HTML, Markdown, and DOCX files.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Settings Panel */}
        <div className="lg:col-span-4 space-y-6">
          {/* Deck Selection Card */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
              <Book className="h-5 w-5 text-primary-600" />
              Target Deck
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Deck
              </label>
              <select
                value={selectedDeck}
                onChange={(e) => setSelectedDeck(e.target.value)}
                className="input-field"
                disabled={uploading || loadingDecks}
              >
                <option value="new">➕ Create New Deck</option>
                {decks.length > 0 && <option disabled>───────────────────</option>}
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name} ({deck.num_questions})
                  </option>
                ))}
              </select>
            </div>

            {selectedDeck === 'new' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deck Name
                  </label>
                  <input
                    type="text"
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                    placeholder="Auto-generated from filename"
                    className="input-field"
                    disabled={uploading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={deckDescription}
                    onChange={(e) => setDeckDescription(e.target.value)}
                    placeholder="Optional description..."
                    rows="2"
                    className="input-field resize-none"
                    disabled={uploading}
                  />
                </div>
              </div>
            )}

            {selectedDeck !== 'new' && (
              <div className="p-3 bg-primary-50 rounded-lg border border-primary-100 animate-fade-in">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={regenerate}
                    onChange={(e) => setRegenerate(e.target.checked)}
                    className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    disabled={uploading}
                  />
                  <div>
                    <span className="font-medium text-gray-900 text-sm">Regenerate Deck</span>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Re-create all questions using new + old docs.
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Configuration Card */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
              <FileType className="h-5 w-5 text-primary-600" />
              Configuration
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Count
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={numQuestions}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '') {
                      setNumQuestions('')
                      return
                    }
                    const parsed = parseInt(val, 10)
                    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
                      setNumQuestions(parsed)
                    }
                  }}
                  onBlur={() => {
                    if (numQuestions === '' || numQuestions < 1) {
                      setNumQuestions(10)
                    }
                  }}
                  className="input-field"
                  disabled={uploading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="input-field"
                  disabled={uploading}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <div className="lg:col-span-8">
          <div
            {...getRootProps()}
            className={`
              relative overflow-hidden rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-300
              ${isDragActive
                ? 'border-primary-500 bg-primary-50/50 scale-[1.02]'
                : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50/50 bg-white'
              }
              ${uploading ? 'opacity-75 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center relative z-10">
              {uploading ? (
                <div className="py-8">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-20 w-20 border-b-2 border-primary-600 mb-6"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary-600">
                      {uploadProgress}%
                    </div>
                  </div>
                  <p className="text-xl font-medium text-gray-900">Uploading Documents</p>
                  <p className="text-gray-500 mt-2">AI is preparing to analyze your content...</p>
                </div>
              ) : (
                <>
                  <div className={`p-6 rounded-full bg-primary-50 mb-6 transition-transform duration-300 ${isDragActive ? 'scale-110' : ''}`}>
                    <UploadIcon className="h-12 w-12 text-primary-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    {isDragActive ? 'Drop files now' : 'Click or drag files here'}
                  </h3>
                  <p className="text-gray-500 mb-8 max-w-md mx-auto">
                    Support for PDF, HTML, Markdown, and DOCX. Upload multiple files to create a comprehensive deck.
                  </p>
                  <div className="flex gap-3 flex-wrap justify-center">
                    {['PDF', 'HTML', 'Markdown', 'DOCX'].map((type) => (
                      <span key={type} className="px-4 py-1.5 bg-gray-100 rounded-full text-sm font-medium text-gray-600 border border-gray-200">
                        {type}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Status Cards */}
          <div className="mt-8 space-y-6">
            {/* Success Message */}
            {result && !generating && (
              <div className="card bg-success-50 border-success-200 animate-fade-in">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-success-100 rounded-full">
                    <CheckCircle className="h-6 w-6 text-success-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-success-900 text-lg">Upload Complete!</h3>
                    <p className="text-success-800 mt-1">{result.message}</p>
                    <p className="text-success-700 text-sm mt-2 font-medium">Redirecting to deck view...</p>
                  </div>
                </div>
              </div>
            )}

            {/* Generation Progress */}
            {generating && generationStatus && (
              <div className="card border-primary-100 shadow-lg animate-slide-up">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-primary-100 rounded-full animate-pulse-slow">
                    <Loader2 className="h-6 w-6 text-primary-600 animate-spin" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">Generating Questions</h3>
                    <p className="text-primary-600 font-medium">{generationStatus.current_step}</p>
                  </div>
                  <span className="text-2xl font-bold text-primary-600">{generationStatus.progress}%</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-100 rounded-full h-3 mb-8 overflow-hidden">
                  <div
                    className="bg-primary-600 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${generationStatus.progress}%` }}
                  ></div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                    <div className="text-gray-500 text-sm mb-1">Documents</div>
                    <div className="text-2xl font-bold text-gray-900">{generationStatus.total_documents}</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                    <div className="text-gray-500 text-sm mb-1">Requested</div>
                    <div className="text-2xl font-bold text-gray-900">{generationStatus.total_questions_requested}</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                    <div className="text-gray-500 text-sm mb-1">Generated</div>
                    <div className="text-2xl font-bold text-primary-600">{generationStatus.total_questions_generated}</div>
                  </div>
                </div>

                {/* Logs */}
                {generationLogs.length > 0 && (
                  <div className="bg-gray-900 rounded-xl p-4 max-h-48 overflow-y-auto custom-scrollbar border border-gray-800">
                    <div className="text-xs font-mono space-y-1.5">
                      {generationLogs.map((log, index) => (
                        <div
                          key={index}
                          className={`${log.level === 'error'
                            ? 'text-red-400'
                            : log.level === 'warning'
                              ? 'text-yellow-400'
                              : 'text-gray-400'
                            }`}
                        >
                          <span className="text-gray-600 select-none">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                          {log.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="card bg-danger-50 border-danger-200 animate-fade-in">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-danger-100 rounded-full">
                    <AlertCircle className="h-6 w-6 text-danger-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-danger-900 text-lg">Upload Failed</h3>
                    <p className="text-danger-800 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
