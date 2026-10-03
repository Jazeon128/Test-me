import { useParams } from 'react-router-dom'
import Spinner from './Spinner'
import FlashcardCard from './FlashcardCard'
import { useState, useEffect, useRef, useCallback } from 'react'
import { notebooksAPI, progressAPI, decksAPI } from '../services/api'
import { Clock, CheckCircle, XCircle, Flame, Trophy, Target, Lightbulb } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function PracticeSession({ deckId, questionIds, onExit, onFinished, onEmpty, embedded = false }) {

  const { notebookId } = useParams()
  const [deckHasItems, setDeckHasItems] = useState(false)
  const [complete, setComplete] = useState(false)
  const completionHeading = useRef(null)
  const completionCard = useRef(null)
  useEffect(() => {
    if (!complete) return
    completionHeading.current?.focus({ preventScroll: true })
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    completionCard.current?.scrollIntoView({ block: 'center', ...(reducedMotion ? {} : { behavior: 'smooth' }) })
  }, [complete])
  const [mode, setMode] = useState('choice')
  const [timerEnabled, setTimerEnabled] = useState(() => {
    try { return localStorage.getItem('testme.practice.timer') === 'true' }
    catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('testme.practice.timer', String(timerEnabled)) }
    catch { /* Practice remains available when storage is unavailable. */ }
  }, [timerEnabled])
  const [writtenAnswer, setWrittenAnswer] = useState('')
  // Feedback from a failed first attempt: a hint (written) or flagged
  // sentences (explain). While set, the next submission is the final one.
  const [feedback, setFeedback] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const submitLock = useRef(false)
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [result, setResult] = useState(null)
  const [timeLeft, setTimeLeft] = useState(30)
  const startTime = useRef(null)
  const answerDuration = useRef(null)
  const [sessionStats, setSessionStats] = useState({
    correct: 0,
    incorrect: 0,
    totalPoints: 0,
    streak: 0,
  })
  const [loading, setLoading] = useState(true)

  const timerRef = useRef(null)
  const flashcard = questions[currentIndex]?.card_type === 'flashcard'
  const allFlashcards = questions.length > 0 && questions.every(question => question.card_type === 'flashcard')
  const mixed = !allFlashcards && questions.some(question => question.card_type === 'flashcard')
  const typed = !flashcard && (mode === 'written' || mode === 'explain')

  const handleSubmit = useCallback((option) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const currentQuestion = questions[currentIndex]
    if (!currentQuestion) return
    answerDuration.current = (Date.now() - startTime.current) / 1000
    const selected = option || ''
    setSelectedOption(selected)
    setResult({
      correct: selected === currentQuestion.correct_option,
      correct_answer: currentQuestion.correct_option,
      explanation: currentQuestion.explanation,
      gamification: { points_earned: 0, streak_bonus: 0 },
    })
    setShowResult(true)
  }, [questions, currentIndex])

  useEffect(() => {
    let cancelled = false
    const loadQuestions = async () => {
      try {
        const response = questionIds
          ? await notebooksAPI.practiceQuestions(notebookId, questionIds)
          : await progressAPI.getReviewSession(50, true, true, deckId ? parseInt(deckId) : null)
        if (!questionIds && deckId && response.data.questions.length === 0) {
          const deck = await decksAPI.get(deckId)
          if (!cancelled) setDeckHasItems(deck.data.num_questions > 0)
        }
        if (!cancelled) setQuestions(response.data.questions)
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load questions:', error)
          onExit()
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadQuestions()
    return () => { cancelled = true }
  }, [deckId, questionIds, notebookId, onExit])

  useEffect(() => {
    if (showResult || questions.length === 0) return
    startTime.current = Date.now()
    answerDuration.current = null
    if (typed || flashcard || !timerEnabled) return
    setTimeLeft(30)
    const deadline = Date.now() + 30000
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) handleSubmit(null)
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [currentIndex, showResult, questions, typed, flashcard, timerEnabled, handleSubmit])

  useEffect(() => {
    if (!loading && questions.length === 0 && !embedded && !deckHasItems) onEmpty()
  }, [loading, questions.length, embedded, deckHasItems, onEmpty])

  const handleGrading = async (quality) => {
    if (submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    setSubmitError('')
    const timeTaken = typed || flashcard ? (Date.now() - startTime.current) / 1000 : answerDuration.current
    const currentQuestion = questions[currentIndex]

    try {
      const response = await progressAPI.submit({
        question_id: currentQuestion.id,
        selected_option: selectedOption || '',
        ...(typed ? {
          written_answer: writtenAnswer.trim(),
          explain: mode === 'explain',
          retry_allowed: !feedback,
          after_feedback: Boolean(feedback),
        } : {}),
        time_taken_seconds: timeTaken,
        manual_quality: quality
      })

      // A failed first attempt: show feedback, record nothing, allow one retry.
      if (response.data.retry) {
        setFeedback(response.data.feedback)
        return
      }

      const successful = flashcard ? quality === 4 || quality === 5 : response.data.correct
      setSessionStats((prev) => ({
        correct: prev.correct + (successful ? 1 : 0),
        incorrect: prev.incorrect + (successful ? 0 : 1),
        totalPoints: prev.totalPoints + response.data.gamification.points_earned + response.data.gamification.streak_bonus,
        streak: successful ? prev.streak + 1 : 0,
      }))

      if (typed) {
        setResult(response.data)
        setShowResult(true)
      } else handleNext()
    } catch (error) {
      console.error('Failed to submit grade:', error)
      setSubmitError(error.message || 'Failed to submit answer. Please retry.')
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  const handleNext = () => {
    setWrittenAnswer('')
    setFeedback(null)
    setSubmitError('')
    startTime.current = Date.now()
    answerDuration.current = null
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setSelectedOption(null)
      setShowResult(false)
      setResult(null)
    } else {
      // Session complete
      setComplete(true)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner aria-label="Loading test session" className="h-12 w-12" />
      </div>
    )
  }

  if (complete) {
    return (
      <div ref={completionCard} className="glass-panel card text-center">
        <h2 ref={completionHeading} tabIndex={-1} className="text-2xl font-bold mb-4">Session complete</h2>
        <div className={`mb-4 grid grid-cols-2 ${allFlashcards ? 'md:grid-cols-4' : 'md:grid-cols-5'} gap-4`}>
          <StatBadge icon={<Target size={20} />} label="Progress" value={`${questions.length}/${questions.length}`} color="blue" />
          <StatBadge icon={<Flame size={20} />} label="Streak" value={sessionStats.streak} color="orange" />
          {!allFlashcards && <StatBadge icon={<Trophy size={20} />} label="Points" value={sessionStats.totalPoints} color="purple" />}
          <StatBadge icon={<CheckCircle size={20} />} label={allFlashcards ? 'Recalled' : mixed ? 'Correct or recalled' : 'Correct'} value={sessionStats.correct} color="green" />
          <StatBadge icon={<XCircle size={20} />} label={allFlashcards ? 'To review' : 'Incorrect'} value={sessionStats.incorrect} color="orange" />
        </div>
        <p>{sessionStats.incorrect === 0 ? 'Nice work.' : 'Missed items come back sooner in Review.'}</p>
        <button className="btn-primary mt-4" onClick={onFinished}>Finish</button>
      </div>
    )
  }

  if (questions.length === 0) {
    if (!embedded && !deckHasItems) return null
    return (
      <div className="max-w-2xl mx-auto px-4">
        <div className="glass-panel bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">No questions available</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{deckHasItems ? 'Nothing is due in this deck. Come back later.' : 'This deck has no questions yet. Generate some in the Studio.'}</p>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  const notebooks = !deckId && !questionIds ? currentQuestion.notebooks || [] : []
  const notebookLine = notebooks.length > 0 && <p className="review-notebook">
    From {notebooks[0].name}{notebooks.length > 1 ? ` and ${notebooks.length - 1} more` : ''}
  </p>
  const progress = ((currentIndex + 1) / questions.length) * 100

  return (
    <div className="max-w-4xl mx-auto px-4">
      {!flashcard && <div className="mb-6">
        <label htmlFor="answer-mode" className="mr-3 font-medium text-gray-700 dark:text-gray-200">Answer mode</label>
        <select id="answer-mode" value={mode} disabled={showResult || submitting}
          className="input-field max-w-xs"
          onChange={(event) => {
            setMode(event.target.value)
            setSelectedOption(null)
            setWrittenAnswer('')
            setFeedback(null)
            setSubmitError('')
            startTime.current = Date.now()
          }}>
          <option value="choice">Multiple choice</option>
          <option value="written">Written answer</option>
          <option value="explain">Explain it</option>
        </select>
        {mode === 'choice' && <label className="practice-timer-switch">
          <input type="checkbox" checked={timerEnabled} disabled={showResult || submitting}
            onChange={event => setTimerEnabled(event.target.checked)} />
          <span>30 s timer</span>
        </label>}
        {mode === 'written' && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Untimed. A wrong first answer gets a hint and one more try. Grading requires a TypeSafe key.</p>}
        {mode === 'explain' && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Explain the idea in plain words. The first check points at unclear or wrong sentences without correcting them. Requires a TypeSafe key.</p>}
      </div>}
      {/* Header Stats */}
      <div className={`mb-6 grid grid-cols-2 ${allFlashcards ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-4`}>
        <StatBadge
          icon={<Target size={20} />}
          label="Progress"
          value={`${currentIndex + 1}/${questions.length}`}
          color="blue"
        />
        <StatBadge
          icon={<Flame size={20} />}
          label="Streak"
          value={sessionStats.streak}
          color="orange"
        />
        {!allFlashcards && <StatBadge
          icon={<Trophy size={20} />}
          label="Points"
          value={sessionStats.totalPoints}
          color="purple"
        />}
        <StatBadge
          icon={<CheckCircle size={20} />}
          label={allFlashcards ? 'Recalled' : mixed ? 'Correct or recalled' : 'Correct'}
          value={sessionStats.correct}
          color="green"
        />
      </div>

      {/* Progress Bar */}
      <div className="practice-progress mb-6 rounded-full h-3 overflow-hidden">
        <motion.div
          className="practice-progress-fill h-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {flashcard ? (
        <>
          {notebookLine}
          <FlashcardCard key={currentQuestion.id} question={currentQuestion}
            submitting={submitting} error={submitError} onRate={handleGrading} />
        </>
      ) : <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="glass-panel bg-white rounded-lg shadow-lg p-8"
        >
          {/* Timer */}
          <div className="mb-6 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${!typed && timerEnabled && timeLeft <= 5 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 animate-pulse' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
              }`}>
              <Clock size={18} />
              <span className="font-bold">{typed || !timerEnabled ? 'Untimed' : `${timeLeft}s`}</span>
            </div>
          </div>

          {notebookLine}
          {/* Question Text */}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {currentQuestion.question_text}
          </h2>

          {/* Options */}
          {typed ? (
            <div className="mb-6">
              <label htmlFor="written-answer" className="block mb-2 font-medium text-gray-700 dark:text-gray-200">
                {mode === 'explain' ? 'Explain the idea behind this, as if to a curious 12-year-old' : 'Your answer'}
              </label>
              <textarea id="written-answer" className="input-field" rows={5} maxLength={10000}
                value={writtenAnswer} onChange={(event) => setWrittenAnswer(event.target.value)}
                disabled={showResult || submitting} />
            </div>
          ) : <div className="space-y-3 mb-6">
            {(currentQuestion.options || []).map((option, idx) => {
              const isSelected = selectedOption === option.option
              const isCorrect = result?.correct_answer === option.option
              const showCorrect = showResult && isCorrect
              const showIncorrect = showResult && isSelected && !result?.correct

              let optionClass = 'border-gray-300 hover:border-primary-500 hover:bg-primary-50 dark:border-gray-600 dark:hover:border-primary-400 dark:hover:bg-primary-900/30'
              if (showCorrect) {
                optionClass = 'border-green-500 bg-green-50 dark:bg-green-900/30'
              } else if (showIncorrect) {
                optionClass = 'border-red-500 bg-red-50 dark:bg-red-900/30'
              } else if (isSelected && !showResult) {
                optionClass = 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
              }

              return (
                <button
                  key={idx}
                  onClick={() => !showResult && setSelectedOption(option.option)}
                  disabled={showResult}
                  className={`w-full text-left p-4 rounded-lg border-2 transition ${optionClass} ${showResult ? 'cursor-default' : 'cursor-pointer'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg text-gray-700 dark:text-gray-200">
                      {option.option}.
                    </span>
                    <span className="text-gray-900 dark:text-white">{option.text}</span>
                    {showCorrect && <CheckCircle className="ml-auto text-green-600" size={24} />}
                    {showIncorrect && <XCircle className="ml-auto text-red-600" size={24} />}
                  </div>
                </button>
              )
            })}
          </div>}

          {feedback && !showResult && <FeedbackPanel feedback={feedback} />}
          {submitError && <p role="alert" className="mb-4 text-red-600">{submitError}</p>}
          {/* Result Feedback */}
          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 p-4 rounded-lg ${result.correct ? 'bg-green-50 dark:bg-green-900/30 border border-green-200' : 'bg-red-50 dark:bg-red-900/30 border border-red-200'
                }`}
            >
              <div className="flex items-start gap-3">
                {result.correct ? (
                  <CheckCircle className="text-green-600 flex-shrink-0 mt-1" size={24} />
                ) : (
                  <XCircle className="text-red-600 flex-shrink-0 mt-1" size={24} />
                )}
                <div>
                  <h3 className={`font-bold mb-2 ${result.correct ? 'text-green-900 dark:text-green-200' : 'text-red-900 dark:text-red-200'}`}>
                    {result.correct ? 'Correct' : 'Incorrect'}
                  </h3>
                  <p className={`text-sm mb-2 ${result.correct ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                    {result.explanation}
                    {result.written_grade && <span className="block mt-2">
                      Score: {result.written_grade.quality}/5{feedback && result.correct ? ' (capped at 3 because it took a second try)' : ''}. Expected answer: {result.written_grade.expected_answer}
                    </span>}
                    {result.written_grade?.points && (
                      <span className="block mt-2">
                        Key points:
                        <span className="mt-1 block space-y-1">
                          {result.written_grade.points.map((point, index) => (
                            <span key={index} className="flex items-start gap-2">
                              {point.covered
                                ? <CheckCircle size={16} className="mt-0.5 shrink-0" aria-label="Covered" />
                                : <XCircle size={16} className="mt-0.5 shrink-0" aria-label="Missed" />}
                              {point.text}
                            </span>
                          ))}
                        </span>
                      </span>
                    )}
                  </p>
                  {result.gamification.points_earned > 0 && (
                    <p className="text-sm font-semibold text-green-700 dark:text-green-200">
                      +{result.gamification.points_earned} points
                      {result.gamification.streak_bonus > 0 && ` (+${result.gamification.streak_bonus} streak bonus!)`}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Grading Buttons */}
          {typed ? (
            <button disabled={submitting || (!showResult && !writtenAnswer.trim())}
              onClick={() => showResult ? handleNext() : handleGrading(undefined)}
              className="w-full rounded-lg bg-primary-600 px-6 py-3 text-white disabled:opacity-50">
              {submitting ? 'Checking…' : showResult ? 'Next question' : feedback ? 'Try again' : mode === 'explain' ? 'Check my explanation' : 'Submit written answer'}
            </button>
          ) : showResult ? (
            <div className="grid grid-cols-4 gap-3">
              <button
                disabled={submitting}
                onClick={() => handleGrading(1)}
                className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 border-2 border-red-200 px-4 py-3 rounded-lg font-bold hover:bg-red-200 dark:border-red-800 dark:hover:bg-red-900/50 transition flex flex-col items-center"
              >
                <span>Again</span>
                <span className="text-xs font-normal opacity-75">&lt; 1m</span>
              </button>
              <button
                disabled={submitting}
                onClick={() => handleGrading(3)}
                className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200 border-2 border-orange-200 px-4 py-3 rounded-lg font-bold hover:bg-orange-200 dark:border-orange-800 dark:hover:bg-orange-900/50 transition flex flex-col items-center"
              >
                <span>Hard</span>
                <span className="text-xs font-normal opacity-75">2d</span>
              </button>
              <button
                disabled={submitting}
                onClick={() => handleGrading(4)}
                className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-200 border-2 border-green-200 px-4 py-3 rounded-lg font-bold hover:bg-green-200 dark:border-green-800 dark:hover:bg-green-900/50 transition flex flex-col items-center"
              >
                <span>Good</span>
                <span className="text-xs font-normal opacity-75">4d</span>
              </button>
              <button
                disabled={submitting}
                onClick={() => handleGrading(5)}
                className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 border-2 border-blue-200 px-4 py-3 rounded-lg font-bold hover:bg-blue-200 dark:border-blue-800 dark:hover:bg-blue-900/50 transition flex flex-col items-center"
              >
                <span>Easy</span>
                <span className="text-xs font-normal opacity-75">7d</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleSubmit(selectedOption)}
              disabled={!selectedOption}
              className="w-full bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:hover:bg-primary-600 disabled:cursor-not-allowed transition"
            >
              Show Answer
            </button>
          )}
        </motion.div>
      </AnimatePresence>}

      {/* Motivational Message */}
      {sessionStats.streak >= 3 && !showResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 rounded-lg p-4 text-center"
        >
          <p className="text-orange-900 dark:text-orange-200 font-semibold">
            🔥 {sessionStats.streak} question streak! Keep it up!
          </p>
        </motion.div>
      )}
    </div>
  )
}

function StatBadge({ icon, label, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200',
    purple: 'bg-purple-100 text-purple-700',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-200',
  }

  return (
    <div className="glass-panel bg-white rounded-lg shadow p-4">
      <div className="flex items-center gap-2 mb-1">
        <div className={`${colorClasses[color]}`}>
          {icon}
        </div>
        <span className="text-xs text-gray-600 dark:text-gray-300">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  )
}

function FeedbackPanel({ feedback }) {
  const flagged = (feedback.sentences || []).filter(sentence => sentence.wrong || sentence.unclear)
  return (
    <div role="status" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <Lightbulb size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-2 text-sm">
          {feedback.hint !== undefined ? (
            <>
              <p className="font-bold">Not quite. Here is a hint.</p>
              <p>{feedback.hint}</p>
            </>
          ) : (
            <>
              <p className="font-bold">
                You covered {feedback.points_covered} of {feedback.points_total} key points.
              </p>
              {flagged.length > 0 ? (
                <ul className="space-y-1">
                  {flagged.map(sentence => (
                    <li key={sentence.index}>
                      <span className="font-medium">&ldquo;{sentence.text}&rdquo;</span>{' '}
                      {sentence.wrong ? 'may be wrong.' : 'is unclear. Say it more plainly.'}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Nothing you wrote is wrong or unclear. Something important is missing.</p>
              )}
            </>
          )}
          <p className="opacity-80">Revise and try once more. The answer is shown after that.</p>
        </div>
      </div>
    </div>
  )
}
