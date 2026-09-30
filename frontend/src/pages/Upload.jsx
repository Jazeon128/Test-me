import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import PropTypes from 'prop-types'
import Spinner from '../components/Spinner'
import { documentsAPI, decksAPI, statusAPI } from '../services/api'
import { Upload as UploadIcon, CheckCircle, AlertCircle, AlertTriangle, Loader2, Book, FileType, Youtube } from 'lucide-react'

function GenerationProgress({ status }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const done = status.current_question || 0
  const total = status.total_questions || 0
  const fraction = total ? Math.min(1, done / total) : 0
  const seconds = status.started_at
    ? Math.max(0, Math.floor((now - new Date(status.started_at).getTime()) / 1000)) : 0
  const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  return (
    <>
      <style>{`
        @keyframes generation-shimmer {
          from { transform: translateX(-100%); }
          to { transform: translateX(400%); }
        }
        .generation-shimmer { animation: generation-shimmer 2s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .generation-shimmer, .generation-spinner { animation: none; }
          .generation-fill { transition: none; }
        }
      `}</style>
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-full">
          <Loader2 className="generation-spinner h-6 w-6 text-primary-600 dark:text-primary-300 animate-spin" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 dark:text-white text-lg">Generating questions</h3>
          <p className="text-primary-600 dark:text-primary-300 font-medium">{status.current_step}</p>
          {total > 0 && <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Section {done} of {total}</p>}
          <p className="text-gray-600 dark:text-gray-400 text-sm">Elapsed {elapsed}</p>
        </div>
      </div>
      <div role="progressbar" aria-label="Sections completed" aria-valuemin={0}
        aria-valuemax={total} aria-valuenow={done}
        className="relative w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 mb-8 overflow-hidden">
        <div className="generation-fill absolute inset-0 bg-primary-600 origin-left transition-transform duration-500 ease-out"
          style={{ transform: `scaleX(${fraction})` }} />
        {fraction < 1 && <div className="absolute inset-y-0 right-0 overflow-hidden" style={{ left: `${fraction * 100}%` }}>
          <div className="generation-shimmer h-full w-1/4 bg-gradient-to-r from-transparent via-primary-300/50 to-transparent" />
        </div>}
      </div>
    </>
  )
}

GenerationProgress.propTypes = {
  status: PropTypes.shape({
    current_step: PropTypes.string,
    current_question: PropTypes.number,
    total_questions: PropTypes.number,
    started_at: PropTypes.string,
  }).isRequired,
}

export default function Upload() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const notebookId = searchParams.get('notebook')
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
  const [activeTab, setActiveTab] = useState('file')
  const [youtubeUrl, setYoutubeUrl] = useState('')

  // Generation status tracking
  const [generating, setGenerating] = useState(false)
  const [, setJobId] = useState(null)
  const [generationStatus, setGenerationStatus] = useState(null)
  const [generationLogs, setGenerationLogs] = useState([])
  const pollRef = useRef(null)
  // An upload whose sources failed pre-flight, waiting for Generate anyway or Cancel.
  const [pendingJob, setPendingJob] = useState(null)
  const [answeringJob, setAnsweringJob] = useState(false)
  // Sources that pre-flight could not check. Generation still runs for them.
  const [uncheckedSources, setUncheckedSources] = useState([])

  useEffect(() => {
    loadDecks()
  }, [])

  // Cleanup status polling on unmount
  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => stopPolling, [])

  // Check generation status
  const checkStatus = async (currentJobId) => {
    try {
      const response = await statusAPI.get(currentJobId)
      const status = response.data

      setGenerationStatus(status)
      setGenerationLogs(status.logs || [])

      if (status.status === 'completed') {
        stopPolling()
        setGenerating(false)
        setResult({
          ...result,
          job_id: currentJobId,
          message: 'Questions generated successfully!'
        })

        // Return to the notebook the upload came from, where the new source,
        // its deck and any canvas of it all sit together. Only fall through to
        // the deck when the upload was not started from a notebook.
        if (!(status.total_questions_flagged > 0) && !status.warnings?.length) {
          setTimeout(() => {
            navigate(notebookId ? `/notebooks/${notebookId}` : `/decks/${status.deck_id}`)
          }, 2000)
        }
      } else if (status.status === 'failed') {
        stopPolling()
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
    const formData = new FormData()

    if (activeTab === 'youtube') {
      if (!youtubeUrl) {
        setError('Please enter a YouTube URL')
        return
      }
      // Create a dummy file object for the YouTube URL
      const blob = new Blob([youtubeUrl], { type: 'text/plain' })
      formData.append('files', blob, 'video.youtube')
    } else {
      if (acceptedFiles.length === 0) return
      acceptedFiles.forEach(file => {
        formData.append('files', file)
      })
    }

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
    // Keep the upload inside the notebook it was started from, so the source
    // and its generated deck land in the same topic.
    if (notebookId) {
      formData.append('notebook_id', notebookId)
    }

    formData.append('regenerate', regenerate)

    setUploading(true)
    setError(null)
    setResult(null)
    setPendingJob(null)
    setUncheckedSources([])

    try {
      const response = await documentsAPI.upload(formData, (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        setUploadProgress(progress)
      })

      setUploading(false)

      if (response.data.status === 'needs_confirmation') {
        setPendingJob(response.data)
        return
      }

      setResult(response.data)
      setUncheckedSources((response.data.preflight || []).filter(item => !item.checked))
      startTracking(response.data.job_id)
    } catch (err) {
      // The API interceptor rejects with the server's reason in message.
      setError(err.message || 'Failed to upload document')
      setUploading(false)
    }
  }

  const startTracking = (newJobId) => {
    setJobId(newJobId)
    setGenerating(true)
    setGenerationLogs([])
    setGenerationStatus(null)

    // Poll every 500ms for smooth progress updates
    stopPolling()
    pollRef.current = setInterval(() => checkStatus(newJobId), 500)
    checkStatus(newJobId)
  }

  const confirmPendingJob = async () => {
    setAnsweringJob(true)
    setError(null)
    try {
      const response = await documentsAPI.confirmGeneration(pendingJob.job_id)
      setResult({ ...pendingJob, ...response.data })
      setPendingJob(null)
      startTracking(pendingJob.job_id)
    } catch (err) {
      setError(err.message || 'Could not start generation')
    } finally {
      setAnsweringJob(false)
    }
  }

  const cancelPendingJob = async () => {
    setAnsweringJob(true)
    setError(null)
    try {
      await documentsAPI.cancelGeneration(pendingJob.job_id)
      setPendingJob(null)
    } catch (err) {
      setError(err.message || 'Could not cancel the upload')
    } finally {
      setAnsweringJob(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/html': ['.html', '.htm'],
      'text/markdown': ['.md'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx']
    },
    multiple: true,
    disabled: uploading,
  })

  return (
    <div className="max-w-5xl mx-auto px-4 pb-12">
      <div className="mb-10">
        <p className="eyebrow">Collect · Understand · Remember</p>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary-700 to-primary-500 dark:from-primary-300 dark:to-primary-400">
          Upload documents
        </h1>
        <p className="page-intro mt-3 text-base">
          Turn your material into something that stays with you.
          We support PDF, HTML, Markdown, DOCX, PPTX, and YouTube.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Settings Panel */}
        <div className="lg:col-span-4 space-y-6">
          {/* Deck Selection Card */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              <Book className="h-5 w-5 text-primary-600 dark:text-primary-300" />
              Target deck
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select deck
              </label>
              <select
                value={selectedDeck}
                onChange={(e) => setSelectedDeck(e.target.value)}
                className="input-field"
                disabled={uploading || loadingDecks}
              >
                <option value="new">➕ Create new deck</option>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Deck name
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
              <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-lg border border-primary-100 animate-fade-in">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={regenerate}
                    onChange={(e) => setRegenerate(e.target.checked)}
                    className="mt-1 h-4 w-4 text-primary-600 dark:text-primary-300 focus:ring-primary-500 border-gray-300 rounded"
                    disabled={uploading}
                  />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white text-sm">Regenerate Deck</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      Re-create all questions using new + old docs.
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Configuration Card */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              <FileType className="h-5 w-5 text-primary-600 dark:text-primary-300" />
              Configuration
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Question count
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
          {/* Upload Method Tabs */}
          <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('file')}
              className={`pb-3 px-1 flex items-center gap-2 font-medium transition-colors relative ${activeTab === 'file'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
            >
              <UploadIcon size={20} />
              File upload
              {activeTab === 'file' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('youtube')}
              className={`pb-3 px-1 flex items-center gap-2 font-medium transition-colors relative ${activeTab === 'youtube'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
            >
              <Youtube size={20} />
              YouTube
              {activeTab === 'youtube' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />
              )}
            </button>
          </div>

          {activeTab === 'file' ? (
            <div
              {...getRootProps()}
              role="button"
              aria-label="Choose files to upload"
              className={`
                glass-panel upload-zone relative overflow-hidden rounded-2xl border-2 border-dashed p-6 md:p-12 text-center cursor-pointer transition-all duration-300
                ${isDragActive
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/30 scale-[1.02]'
                  : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:bg-gray-50/50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800'
                }
                ${uploading ? 'opacity-75 cursor-not-allowed' : ''}
              `}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center relative z-10">
                {uploading ? (
                  <div className="py-8">
                    <div className="relative">
                      <Spinner aria-label="Generating questions" className="h-20 w-20 mb-6" />
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary-600 dark:text-primary-300">
                        {uploadProgress}%
                      </div>
                    </div>
                    <p className="text-xl font-medium text-gray-900 dark:text-white">Uploading Documents</p>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">AI is preparing to analyze your content...</p>
                  </div>
                ) : (
                  <>
                    <div className={`upload-orbit p-6 rounded-full mb-8 transition-transform duration-300 ${isDragActive ? 'scale-110' : ''}`}>
                      <UploadIcon className="h-12 w-12 text-primary-600 dark:text-primary-300" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                      {isDragActive ? 'Drop files now' : 'Drop your next discovery here'}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
                      Choose files or drop them here. Add one source or bring a whole topic together.
                    </p>
                    <div className="material-types flex gap-3 flex-wrap justify-center">
                      {['PDF', 'HTML', 'MD', 'DOCX', 'PPTX'].map((type) => (
                        <span key={type} className="px-4 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm font-medium text-gray-600 dark:text-gray-200 border border-gray-200 dark:border-gray-600">
                          {type}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 md:p-12">
              <div className="max-w-xl mx-auto text-center">
                <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                  <Youtube className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Import from YouTube
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Paste a YouTube video URL to generate questions from its transcript.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="min-w-0 flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                  <button
                    onClick={() => onDrop([])}
                    disabled={uploading || !youtubeUrl}
                    className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Status Cards */}
          <div className="mt-8 space-y-6">
            {/* Pre-flight: a source looks unteachable, so nothing is generated until the user decides */}
            {pendingJob && (
              <div className="card border-amber-300 dark:border-amber-700" role="alertdialog" aria-labelledby="preflight-title">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                    <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-300" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 id="preflight-title" className="font-bold text-gray-900 dark:text-white text-lg">
                      This may not have anything to study
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mt-1">
                      Nothing has been generated yet. Generating from a source with no examinable facts
                      tends to produce questions about filler.
                    </p>
                    <ul className="mt-4 space-y-2">
                      {pendingJob.preflight.map(item => (
                        <li key={item.document_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm">
                          <span className="font-medium text-gray-900 dark:text-white break-all">{item.display_name || item.filename}</span>
                          <span className={item.worth_generating ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}>
                            {!item.checked
                              ? 'Not checked'
                              : item.worth_generating
                                ? 'Looks teachable'
                                : `Little to study (${Math.round(item.is_teachable * 100)}% teachable)`}
                            {item.checked && item.is_transcript >= 0.7 && ' · reads like a transcript'}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button type="button" onClick={confirmPendingJob} disabled={answeringJob} className="btn-primary inline-flex">
                        Generate anyway
                      </button>
                      <button type="button" onClick={cancelPendingJob} disabled={answeringJob} className="btn-secondary inline-flex">
                        Cancel upload
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pre-flight could not run for these sources. Generation continues regardless. */}
            {uncheckedSources.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-300" role="status">
                Could not check {uncheckedSources.map(item => item.display_name || item.filename).join(', ')} before generating.
                Generation is going ahead anyway.
              </p>
            )}

            {/* Success Message */}
            {result && !generating && generationStatus?.status !== 'failed' && (
              <div className="card bg-success-50 dark:bg-success-900/30 border-success-200 animate-fade-in">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-full">
                    <CheckCircle className="h-6 w-6 text-success-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-success-900 dark:text-success-200 text-lg">Upload complete</h3>
                    <p className="text-success-800 dark:text-success-200 mt-1">{result.message}</p>
                    {generationStatus?.status === 'completed' && generationStatus.warnings?.map((warning, index) => (
                      <div key={index} role="alert"
                        className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                        {warning}
                      </div>
                    ))}
                    {generationStatus?.status === 'completed' && (generationStatus.total_questions_flagged > 0 || generationStatus.warnings?.length > 0) ? (
                      <button type="button" className="btn-primary mt-3"
                        onClick={() => navigate(notebookId ? `/notebooks/${notebookId}` : `/decks/${generationStatus.deck_id}`)}>
                        Continue
                      </button>
                    ) : (
                      <p className="text-success-700 dark:text-success-200 text-sm mt-2 font-medium">Redirecting to deck view...</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Generation Progress */}
            {generationStatus && (generating || generationStatus.status === 'completed') && (
              <div className="card border-primary-100 shadow-lg">
                <GenerationProgress status={generationStatus} />

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 text-center border border-gray-100">
                    <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Documents</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{generationStatus.total_documents}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 text-center border border-gray-100">
                    <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Requested</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{generationStatus.total_questions_requested}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 text-center border border-gray-100">
                    <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Generated</div>
                    <div className="text-2xl font-bold text-primary-600 dark:text-primary-300">{generationStatus.total_questions_generated}</div>
                    {generationStatus.status === 'completed' && generationStatus.total_questions_flagged > 0 && (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        {generationStatus.total_questions_flagged} question(s) held back by the quality check.{' '}
                        <Link className="text-primary-600 dark:text-primary-300 underline" to={`/decks/${generationStatus.deck_id}`}>Review them on the deck page.</Link>
                      </p>
                    )}
                  </div>
                </div>

                {/* Logs */}
                {generationLogs.length > 0 && (
                  <div className="bg-gray-900 rounded-xl p-4 max-h-48 overflow-y-auto custom-scrollbar border border-gray-800">
                    <div className="text-xs font-mono space-y-1.5">
                      {generationLogs.map((log, index) => (
                        <div
                          key={index}
                          className={`font-mono ${log.level === 'error' ? 'text-red-400' : 'text-gray-300'
                            }`}
                        >
                          <span className="text-gray-500 dark:text-gray-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
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
              <div className="card bg-red-50 dark:bg-red-900/30 border-red-200 animate-shake">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-red-900 dark:text-red-200 text-lg">Upload failed</h3>
                    <p className="text-red-800 dark:text-red-200 mt-1">{error}</p>
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
