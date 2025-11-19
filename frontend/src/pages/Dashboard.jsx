import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { progressAPI } from '../services/api'
import { Brain, Target, Flame, Trophy, Play } from 'lucide-react'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const response = await progressAPI.getStats()
      setStats(response.data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const startReviewSession = async () => {
    navigate('/practice')
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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome to FlashLearn</h1>
        <p className="mt-2 text-gray-600">
          Your gamified learning platform with spaced repetition
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={<Brain className="h-8 w-8" />}
          title="Questions Seen"
          value={stats?.total_questions_seen || 0}
          color="blue"
        />
        <StatCard
          icon={<Target className="h-8 w-8" />}
          title="Success Rate"
          value={`${Math.round((stats?.overall_success_rate || 0) * 100)}%`}
          color="green"
        />
        <StatCard
          icon={<Flame className="h-8 w-8" />}
          title="Current Streak"
          value={stats?.current_streak || 0}
          color="orange"
        />
        <StatCard
          icon={<Trophy className="h-8 w-8" />}
          title="Mastered"
          value={stats?.questions_mastered || 0}
          color="purple"
        />
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Start Review */}
        <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg shadow-lg p-8 text-white">
          <h2 className="text-2xl font-bold mb-2">Ready to Learn?</h2>
          <p className="mb-6 opacity-90">
            {stats?.questions_due > 0
              ? `You have ${stats.questions_due} questions due for review`
              : 'Start a new review session'}
          </p>
          <button
            onClick={startReviewSession}
            className="bg-white text-primary-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition flex items-center gap-2"
          >
            <Play size={20} />
            Start Review Session
          </button>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Quick Stats</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Attempts:</span>
              <span className="font-semibold">{stats?.total_attempts || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Best Streak:</span>
              <span className="font-semibold">{stats?.best_streak || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Mastery Rate:</span>
              <span className="font-semibold">
                {Math.round((stats?.mastery_rate || 0) * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg. Easiness:</span>
              <span className="font-semibold">
                {(stats?.average_easiness_factor || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Getting Started */}
      {stats?.total_questions_seen === 0 && (
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Getting Started
          </h3>
          <p className="text-blue-800 mb-4">
            Upload your first document to start generating questions and begin your learning journey!
          </p>
          <button
            onClick={() => navigate('/upload')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Upload Document
          </button>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, title, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-orange-100 text-orange-600',
    purple: 'bg-purple-100 text-purple-600',
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className={`inline-flex p-3 rounded-lg ${colorClasses[color]}`}>
        {icon}
      </div>
      <div className="mt-4">
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
    </div>
  )
}
