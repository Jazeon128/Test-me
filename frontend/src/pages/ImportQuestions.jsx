import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { testsAPI } from '../services/api'
import { FileDown, Info, CheckCircle, AlertCircle } from 'lucide-react'

export default function ImportQuestions() {
  const navigate = useNavigate()
  const [questionsText, setQuestionsText] = useState('')
  const [deckName, setDeckName] = useState('')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const exampleFormat = `Question 1: What is the primary purpose of Cloud Storage?
A) Compute instances
B) Object storage
C) Database management
D) Network configuration
Correct Answer: B
Explanation: Cloud Storage is Google Cloud's object storage service...

Question 2: Which service provides...
A) Service A
B) Service B
C) Service C
D) Service D
Correct Answer: C
Explanation: Service C provides...`

  const parseQuestions = (text) => {
    const questions = []
    const questionBlocks = text.split(/Question\s+\d+:/i).filter(block => block.trim())

    for (const block of questionBlocks) {
      try {
        const lines = block.trim().split('\n').filter(line => line.trim())

        // Extract question text
        const questionText = lines[0].trim()

        // Extract options
        const options = []
        const optionRegex = /^([A-D])\)\s*(.+)$/i

        for (const line of lines) {
          const match = line.match(optionRegex)
          if (match) {
            options.push({
              option: match[1].toUpperCase(),
              text: match[2].trim()
            })
          }
        }

        // Extract correct answer
        const correctAnswerLine = lines.find(line => line.match(/correct\s+answer:/i))
        const correctAnswer = correctAnswerLine
          ? correctAnswerLine.match(/:\s*([A-D])/i)?.[1]?.toUpperCase()
          : null

        // Extract explanation
        const explanationIndex = lines.findIndex(line => line.match(/explanation:/i))
        const explanation = explanationIndex >= 0
          ? lines.slice(explanationIndex).join(' ').replace(/explanation:\s*/i, '').trim()
          : ''

        if (questionText && options.length === 4 && correctAnswer) {
          questions.push({
            question: questionText,
            options,
            correct_answer: correctAnswer,
            explanation: explanation || 'No explanation provided.',
            difficulty: 'medium'
          })
        }
      } catch (err) {
        console.error('Failed to parse question block:', err)
      }
    }

    return questions
  }

  const handleImport = async () => {
    setError(null)
    setResult(null)

    if (!questionsText.trim()) {
      setError('Please paste questions to import')
      return
    }

    if (!deckName.trim()) {
      setError('Please enter a deck name')
      return
    }

    setProcessing(true)

    try {
      // Parse the questions
      const parsedQuestions = parseQuestions(questionsText)

      if (parsedQuestions.length === 0) {
        setError('No valid questions found. Please check the format.')
        setProcessing(false)
        return
      }

      // Create a deck/test with these questions
      // Note: We'll need to create a backend endpoint for this
      // For now, show what was parsed
      setResult({
        count: parsedQuestions.length,
        questions: parsedQuestions
      })

      // TODO: Call backend to create deck and export to Anki
      // const response = await testsAPI.createFromQuestions({
      //   name: deckName,
      //   questions: parsedQuestions
      // })

    } catch (err) {
      setError(err.message || 'Failed to import questions')
    } finally {
      setProcessing(false)
    }
  }

  const handleExportAnki = () => {
    // TODO: Implement Anki export for imported questions
    alert('Anki export will be implemented in the backend')
  }

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Import Questions for Anki</h1>
        <p className="mt-2 text-gray-600">
          Paste existing questions to create an Anki deck without uploading documents
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input Form */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Deck Information</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deck Name *
              </label>
              <input
                type="text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="e.g., GCP ACE Practice Questions"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={processing}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Questions *
              </label>
              <textarea
                value={questionsText}
                onChange={(e) => setQuestionsText(e.target.value)}
                placeholder={exampleFormat}
                rows="20"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                disabled={processing}
              />
              <p className="text-xs text-gray-500 mt-1">
                Paste questions in the format shown. Each question should include 4 options (A-D), correct answer, and explanation.
              </p>
            </div>

            <button
              onClick={handleImport}
              disabled={processing || !questionsText.trim() || !deckName.trim()}
              className="w-full mt-4 bg-primary-600 text-white px-4 py-3 rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : 'Parse Questions'}
            </button>
          </div>
        </div>

        {/* Right: Instructions & Results */}
        <div className="space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Format Requirements</h3>
                <div className="text-sm text-blue-800 space-y-2">
                  <p>Each question must include:</p>
                  <ul className="list-disc ml-4 space-y-1">
                    <li><strong>Question number:</strong> "Question 1:", "Question 2:", etc.</li>
                    <li><strong>Question text:</strong> The actual question</li>
                    <li><strong>Four options:</strong> A), B), C), D) with text</li>
                    <li><strong>Correct answer:</strong> "Correct Answer: X" (A, B, C, or D)</li>
                    <li><strong>Explanation:</strong> "Explanation: ..." (optional but recommended)</li>
                  </ul>
                  <p className="mt-2">Separate multiple questions with blank lines.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-900">Successfully Parsed!</h3>
                  <p className="text-green-800 text-sm mt-1">
                    Found {result.count} valid question{result.count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-4">
                {result.questions.map((q, idx) => (
                  <div key={idx} className="bg-white border border-green-200 rounded-lg p-4 text-sm">
                    <p className="font-medium text-gray-900 mb-2">
                      {idx + 1}. {q.question}
                    </p>
                    <div className="space-y-1 mb-2">
                      {q.options.map((opt) => (
                        <div
                          key={opt.option}
                          className={`pl-2 ${
                            opt.option === q.correct_answer
                              ? 'text-green-700 font-medium'
                              : 'text-gray-600'
                          }`}
                        >
                          {opt.option}) {opt.text}
                          {opt.option === q.correct_answer && ' ✓'}
                        </div>
                      ))}
                    </div>
                    {q.explanation && (
                      <p className="text-xs text-gray-600 italic border-t border-gray-200 pt-2">
                        {q.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={handleExportAnki}
                className="w-full mt-4 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                <FileDown size={20} />
                Export to Anki (.apkg)
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Error</h3>
                <p className="text-red-800 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
