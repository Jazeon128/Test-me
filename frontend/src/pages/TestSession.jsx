import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { progressAPI } from '../services/api'
import { Clock, CheckCircle, XCircle, Flame, Trophy, Target, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function TestSession() {
  const { testId } = useParams()
  const navigate = useNavigate()

  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [result, setResult] = useState(null)
  const [timeLeft, setTimeLeft] = useState(30)
  const [startTime, setStartTime] = useState(null)
  const [sessionStats, setSessionStats] = useState({
    correct: 0,
    incorrect: 0,
    totalPoints: 0,
    streak: 0,
  })
  const [loading, setLoading] = useState(true)

  const timerRef = useRef(null)

  useEffect(() => {
    loadQuestions()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!showResult && questions.length > 0) {
      startTimer()
      setStartTime(Date.now())
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [currentIndex, showResult, questions])

  const loadQuestions = async () => {
    try {
      const response = await progressAPI.getReviewSession(10, true, true)
      setQuestions(response.data.questions)
    } catch (error) {
      console.error('Failed to load questions:', error)
      alert('Failed to load questions')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeLeft(30)

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up - auto submit
          handleSubmit(null)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleSubmit = async (option) => {
    if (timerRef.current) clearInterval(timerRef.current)

    const timeTaken = (Date.now() - startTime) / 1000
    const currentQuestion = questions[currentIndex]

    try {
      const response = await progressAPI.submit({
        question_id: currentQuestion.id,
        selected_option: option || 'A', // Default if time ran out
        time_taken_seconds: timeTaken,
      })

      setResult(response.data)
      setShowResult(true)

      // Update session stats
      setSessionStats((prev) => ({
        correct: prev.correct + (response.data.correct ? 1 : 0),
        incorrect: prev.incorrect + (response.data.correct ? 0 : 1),
        totalPoints: prev.totalPoints + response.data.gamification.points_earned + response.data.gamification.streak_bonus,
        streak: response.data.correct ? prev.streak + 1 : 0,
      }))
    } catch (error) {
      console.error('Failed to submit answer:', error)
      alert('Failed to submit answer')
    }
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setSelectedOption(null)
      setShowResult(false)
      setResult(null)
    } else {
      // Session complete
      navigate('/progress')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No Questions Available</h2>
          <p className="text-gray-600 mb-6">Upload a document to generate questions first.</p>
          <button
            onClick={() => navigate('/upload')}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition"
          >
            Upload Document
          </button>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  const progress = ((currentIndex + 1) / questions.length) * 100

  return (
    <div className="max-w-4xl mx-auto px-4">
      {/* Header Stats */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <StatBadge
          icon={<Trophy size={20} />}
          label="Points"
          value={sessionStats.totalPoints}
          color="purple"
        />
        <StatBadge
          icon={<CheckCircle size={20} />}
          label="Correct"
          value={sessionStats.correct}
          color="green"
        />
      </div>

      {/* Progress Bar */}
      <div className="mb-6 bg-gray-200 rounded-full h-3 overflow-hidden">
        <motion.div
          className="bg-primary-600 h-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="bg-white rounded-lg shadow-lg p-8"
        >
          {/* Timer */}
          <div className="mb-6 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              timeLeft <= 5 ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-gray-100 text-gray-700'
            }`}>
              <Clock size={18} />
              <span className="font-bold">{timeLeft}s</span>
            </div>
          </div>

          {/* Question Text */}
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {currentQuestion.question_text}
          </h2>

          {/* Options */}
          <div className="space-y-3 mb-6">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedOption === option.option
              const isCorrect = result?.correct_answer === option.option
              const showCorrect = showResult && isCorrect
              const showIncorrect = showResult && isSelected && !result?.correct

              let optionClass = 'border-gray-300 hover:border-primary-500 hover:bg-primary-50'
              if (showCorrect) {
                optionClass = 'border-green-500 bg-green-50'
              } else if (showIncorrect) {
                optionClass = 'border-red-500 bg-red-50'
              } else if (isSelected && !showResult) {
                optionClass = 'border-primary-500 bg-primary-50'
              }

              return (
                <button
                  key={idx}
                  onClick={() => !showResult && setSelectedOption(option.option)}
                  disabled={showResult}
                  className={`w-full text-left p-4 rounded-lg border-2 transition ${optionClass} ${
                    showResult ? 'cursor-default' : 'cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg text-gray-700">
                      {option.option}.
                    </span>
                    <span className="text-gray-900">{option.text}</span>
                    {showCorrect && <CheckCircle className="ml-auto text-green-600" size={24} />}
                    {showIncorrect && <XCircle className="ml-auto text-red-600" size={24} />}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Result Feedback */}
          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 p-4 rounded-lg ${
                result.correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.correct ? (
                  <CheckCircle className="text-green-600 flex-shrink-0 mt-1" size={24} />
                ) : (
                  <XCircle className="text-red-600 flex-shrink-0 mt-1" size={24} />
                )}
                <div>
                  <h3 className={`font-bold mb-2 ${result.correct ? 'text-green-900' : 'text-red-900'}`}>
                    {result.correct ? 'Correct!' : 'Incorrect'}
                  </h3>
                  <p className={`text-sm mb-2 ${result.correct ? 'text-green-800' : 'text-red-800'}`}>
                    {result.explanation}
                  </p>
                  {result.gamification.points_earned > 0 && (
                    <p className="text-sm font-semibold text-green-700">
                      +{result.gamification.points_earned} points
                      {result.gamification.streak_bonus > 0 && ` (+${result.gamification.streak_bonus} streak bonus!)`}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!showResult ? (
              <button
                onClick={() => handleSubmit(selectedOption)}
                disabled={!selectedOption}
                className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                Submit Answer
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition flex items-center justify-center gap-2"
              >
                {currentIndex < questions.length - 1 ? (
                  <>
                    Next Question
                    <ArrowRight size={20} />
                  </>
                ) : (
                  'Finish Session'
                )}
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Motivational Message */}
      {sessionStats.streak >= 3 && !showResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-4 text-center"
        >
          <p className="text-orange-900 font-semibold">
            🔥 {sessionStats.streak} question streak! Keep it up!
          </p>
        </motion.div>
      )}
    </div>
  )
}

function StatBadge({ icon, label, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-700',
    orange: 'bg-orange-100 text-orange-700',
    purple: 'bg-purple-100 text-purple-700',
    green: 'bg-green-100 text-green-700',
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center gap-2 mb-1">
        <div className={`${colorClasses[color]}`}>
          {icon}
        </div>
        <span className="text-xs text-gray-600">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
