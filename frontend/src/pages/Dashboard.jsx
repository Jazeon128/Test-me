import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { progressAPI } from '../services/api'
import { Brain, Target, Flame, Trophy, Play, Plus, ArrowRight } from 'lucide-react'

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
    <div className="max-w-6xl mx-auto px-4 pb-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">
          Welcome back! 👋
        </h1>
        <p className="text-lg text-gray-600">
          Ready to continue your learning journey?
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={<Brain className="h-6 w-6" />}
          title="Questions Seen"
          value={stats?.total_questions_seen || 0}
          color="primary"
        />
        <StatCard
          icon={<Target className="h-6 w-6" />}
          title="Success Rate"
          value={`${Math.round((stats?.overall_success_rate || 0) * 100)}%`}
          color="success"
        />
        <StatCard
          icon={<Flame className="h-6 w-6" />}
          title="Current Streak"
          value={stats?.current_streak || 0}
          color="warning"
        />
        <StatCard
          icon={<Trophy className="h-6 w-6" />}
          title="Mastered"
          value={stats?.questions_mastered || 0}
          color="purple"
        />
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Start Review */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-xl p-8 transition-transform hover:scale-[1.01] duration-300">
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-3">Ready to Learn?</h2>
            <p className="mb-8 text-primary-100 text-lg">
              {stats?.questions_due > 0
                ? `You have ${stats.questions_due} questions due for review.`
                : 'Start a new review session to keep your streak alive!'}
            </p>
            <button
              onClick={startReviewSession}
              className="bg-white text-primary-700 px-8 py-4 rounded-xl font-bold hover:bg-gray-50 transition shadow-lg flex items-center gap-3 group"
            >
              <Play className="h-5 w-5 fill-current group-hover:scale-110 transition-transform" />
              Start Review Session
            </button>
          </div>

          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-primary-400 opacity-20 rounded-full blur-2xl"></div>
        </div>

        {/* Quick Stats */}
        <div className="card h-full">
          <h2 className="text-xl font-bold mb-6 text-gray-900 flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary-600" />
            Quick Stats
          </h2>
          <div className="space-y-5">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600 font-medium">Total Attempts</span>
              <span className="font-bold text-gray-900 text-lg">{stats?.total_attempts || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600 font-medium">Best Streak</span>
              <span className="font-bold text-gray-900 text-lg">{stats?.best_streak || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600 font-medium">Mastery Rate</span>
              <span className="font-bold text-gray-900 text-lg">
                {Math.round((stats?.mastery_rate || 0) * 100)}%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600 font-medium">Avg. Easiness</span>
              <span className="font-bold text-gray-900 text-lg">
                {(stats?.average_easiness_factor || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Getting Started */}
      {stats?.total_questions_seen === 0 && (
        <div className="mt-10 bg-white border border-primary-100 rounded-2xl p-8 shadow-sm relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Start Your Journey 🚀
              </h3>
              <p className="text-gray-600 text-lg max-w-xl">
                Upload your first document (PDF, HTML, Markdown) to automatically generate flashcards and begin learning.
              </p>
            </div>
            <button
              onClick={() => navigate('/upload')}
              className="btn-primary px-8 py-4 flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="h-5 w-5" />
              Upload Document
            </button>
          </div>
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-l from-primary-50 to-transparent -z-0"></div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, title, value, color }) {
  const colorStyles = {
    primary: 'bg-primary-100 text-primary-600',
    success: 'bg-success-100 text-success-600',
    warning: 'bg-orange-100 text-orange-600',
    purple: 'bg-purple-100 text-purple-600',
  }

  return (
    <div className="card hover:shadow-md transition-all duration-200 hover:-translate-y-1">
      <div className={`inline-flex p-3 rounded-xl mb-4 ${colorStyles[color] || colorStyles.primary}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900 tracking-tight">{value}</p>
      </div>
    </div>
  )
}
