import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import { X, Sparkles, Loader2 } from 'lucide-react'
import { canvasAPI } from '../services/api'
import PassageText from '../components/PassageText'
import { serverMessage } from '../utils/serverMessage'

/**
 * The passage a node came from, and the way back into practice.
 *
 * This panel is what makes the canvas more than a picture: every node points at
 * the text it was drawn from, and "Test me on this" generates questions scoped
 * to exactly that passage.
 */
export default function NodePanel({ canvasId, node, source, onClose }) {
  const [result, setResult] = useState({ questions: [], held_back: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [shownAnswers, setShownAnswers] = useState({})
  const questions = result.questions

  useEffect(() => {
    let active = true
    setResult({ questions: [], held_back: 0 })
    setShownAnswers({})
    setLoading(true)
    setError(null)
    canvasAPI.savedQuestionsForNode(canvasId, node.id).then(response => {
      if (active) setResult(response.data)
    }).catch(err => {
      if (active) setError(serverMessage(err.originalError || err) || 'Could not load questions for this node.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [canvasId, node.id])

  const testMe = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = questions.length
        ? await canvasAPI.questionsForNode(canvasId, node.id, 3, true)
        : await canvasAPI.questionsForNode(canvasId, node.id)
      setResult(response.data)
    } catch (err) {
      setError(serverMessage(err.originalError || err) || 'Could not generate questions for this node.')
    } finally {
      setLoading(false)
    }
  }
  const deckUrl = `/notebooks/${result.notebook_id}?deck=${result.deck_id}`

  return (
    <aside
      className="tm-canvas flex w-full min-w-0 shrink-0 flex-col border-l md:w-[360px]"
      style={{ background: 'var(--chrome)', borderColor: 'var(--line)' }}
      aria-label="Node source"
    >
      <header
        className="flex items-start gap-2 border-b p-4"
        style={{ borderColor: 'var(--line)' }}
      >
        <div className="flex-1">
          <div className="text-xs" style={{ color: 'var(--text3)' }}>
            {source?.section?.heading ? <strong>{source.section.heading}</strong> : 'Source passage'}
            {source?.section?.page != null && <div>Page {source.section.page}</div>}
          </div>
          <h3 className="mt-0.5 text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {node.data.label}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close source panel"
          className="rounded p-1"
          style={{ color: 'var(--text3)' }}
        >
          <X size={16} />
        </button>
      </header>

      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {source?.section ? (
          <div
            className="whitespace-pre-wrap text-sm leading-relaxed"
            style={{ color: 'var(--text2)', overflowWrap: 'anywhere' }}
          >
            <PassageText text={source.section.text} />
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--rose-i)' }}>
            This node has no source passage. It was drawn without a citation that
            resolved, so there is nothing to show or be tested on.
          </p>
        )}

        {error && (
          <p className="mt-4 text-sm" style={{ color: 'var(--rose-i)' }} role="alert">
            {error}
          </p>
        )}

        {questions && (
          <div className="mt-5 space-y-4">
            {questions.map((question, index) => (
              <div
                key={question.id || index}
                className="rounded-lg border p-3"
                style={{ borderColor: 'var(--line)', background: 'var(--s2)' }}
              >
                <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {question.card_type === 'flashcard' && <strong>Front: </strong>}{question.question}
                </div>
                {question.card_type !== 'flashcard' && <ul className="mt-2 space-y-1">
                  {(question.options || []).map((option) => (
                    <li key={option.option} className="text-xs" style={{ color: 'var(--text2)' }}>
                      <span className="tm-mono">{option.option}.</span> {option.text}
                    </li>
                  ))}
                </ul>}
                <button type="button" className="mt-2 text-sm" aria-expanded={!!shownAnswers[question.id]}
                  onClick={() => setShownAnswers(current => ({ ...current, [question.id]: !current[question.id] }))}>
                  {shownAnswers[question.id] ? 'Hide answer' : 'Show answer'}
                </button>
                {shownAnswers[question.id] && <p className="mt-2 text-sm">
                  {question.card_type === 'flashcard' ? 'Back: ' : `Answer: ${question.correct_answer}. `}{question.explanation}
                </p>}
              </div>
            ))}
          </div>
        )}
        {result.deck_id && <div className="mt-4">
          <Link className="btn-primary" to={`${deckUrl}&view=practice`}>Practise canvas deck</Link>
        </div>}
        {result.held_back > 0 && <p className="mt-4 text-sm">
          {result.held_back} held back by the quality check.{' '}
          <Link to={`${deckUrl}&view=edit`}>Review</Link>
        </p>}
      </div>

      {source?.section && (
        <div className="border-t p-4" style={{ borderColor: 'var(--line)' }}>
          <button
            type="button"
            onClick={testMe}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)', minHeight: 44 }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? 'Generating...' : questions.length ? 'Make 3 more' : 'Test me on this'}
          </button>
        </div>
      )}
    </aside>
  )
}

NodePanel.propTypes = {
  canvasId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  node: PropTypes.object.isRequired,
  source: PropTypes.object,
  onClose: PropTypes.func.isRequired,
}
