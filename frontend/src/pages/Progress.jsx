import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { progressAPI } from '../services/api'
import { TrendingUp, Award, Clock, Target, Flame, Trophy } from 'lucide-react'

export default function Progress() {
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pb-12">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary-700 to-primary-500">
          Your Progress
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Track your learning journey and celebrate your achievements.
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          icon={<Target className="h-8 w-8" />}
          title="Questions Seen"
          value={stats?.total_questions_seen || 0}
          subtitle={`${stats?.total_attempts || 0} total attempts`}
          color="primary"
        />
        <StatCard
          icon={<TrendingUp className="h-8 w-8" />}
          title="Success Rate"
          value={`${Math.round((stats?.overall_success_rate || 0) * 100)}%`}
          subtitle={`${stats?.questions_mastered || 0} mastered`}
          color="success"
        />
        <StatCard
          icon={<Flame className="h-8 w-8" />}
          title="Current Streak"
          value={stats?.current_streak || 0}
          subtitle={`Best: ${stats?.best_streak || 0}`}
          color="warning"
        />
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Mastery Progress */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary-600" />
            Mastery Progress
          </h2>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Questions Mastered</span>
                <span className="text-sm font-bold text-gray-900">
                  {stats?.questions_mastered || 0} / {stats?.total_questions_seen || 0}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary-600 h-full transition-all duration-1000 ease-out"
                  style={{ width: `${(stats?.mastery_rate || 0) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-gray-100">
              <div>
                <p className="text-sm text-gray-500 mb-1">Mastery Rate</p>
                <p className="text-3xl font-bold text-gray-900">
                  {Math.round((stats?.mastery_rate || 0) * 100)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Avg. Easiness</p>
                <p className="text-3xl font-bold text-gray-900">
                  {(stats?.average_easiness_factor || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Due for Review */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary-600" />
            Review Status
          </h2>
          <div className="space-y-6">
            <div className="text-center py-4">
              <p className="text-6xl font-bold text-primary-600 mb-2 tracking-tight">
                {stats?.questions_due || 0}
              </p>
              <p className="text-gray-500 font-medium">Questions Due for Review</p>
            </div>

            {stats?.questions_due > 0 ? (
              <button
                onClick={() => navigate('/practice')}
                className="w-full btn-primary py-3 text-lg shadow-lg shadow-primary-500/20"
              >
                Start Review Session
              </button>
            ) : (
              <div className="bg-success-50 border border-success-100 rounded-xl p-4 text-center">
                <p className="text-success-800 font-bold flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  All caught up! Great job!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="mt-8 card">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Award className="h-6 w-6 text-yellow-500" />
          Achievements
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Achievement
            title="First Steps"
            description="Answer 1 question"
            achieved={stats?.total_attempts >= 1}
          />
          <Achievement
            title="Getting Started"
            description="Answer 10 questions"
            achieved={stats?.total_attempts >= 10}
          />
          <Achievement
            title="Dedicated Learner"
            description="Answer 50 questions"
            achieved={stats?.total_attempts >= 50}
          />
          <Achievement
            title="Streak Master"
            description="Get a 10 question streak"
            achieved={stats?.best_streak >= 10}
          />
          <Achievement
            title="High Achiever"
            description="Reach 80% success rate"
            achieved={(stats?.overall_success_rate || 0) >= 0.8}
          />
          <Achievement
            title="Master of One"
            description="Master 1 question"
            achieved={stats?.questions_mastered >= 1}
          />
          <Achievement
            title="Expert"
            description="Master 10 questions"
            achieved={stats?.questions_mastered >= 10}
          />
          <Achievement
            title="Grand Master"
            description="Master 50 questions"
            achieved={stats?.questions_mastered >= 50}
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, title, value, subtitle, color }) {
  const colorStyles = {
    primary: 'bg-primary-100 text-primary-600',
    success: 'bg-success-100 text-success-600',
    warning: 'bg-orange-100 text-orange-600',
  }

  return (
    <div className="card hover:shadow-md transition-shadow duration-200 group">
      <div className={`inline-flex p-3 rounded-xl transition-transform duration-300 group-hover:scale-110 ${colorStyles[color] || colorStyles.primary}`}>
        {icon}
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-4xl font-bold text-gray-900 mt-2 tracking-tight">{value}</p>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

function Achievement({ title, description, achieved }) {
  return (
    <div className={`p-4 rounded-xl border transition-all duration-200 ${achieved
      ? 'border-yellow-400 bg-yellow-50/50 shadow-sm'
      : 'border-gray-100 bg-gray-50/50 opacity-60 grayscale'
      }`}>
      <div className="text-center">
        <div className="text-3xl mb-3 transform transition-transform hover:scale-110 duration-200">
          {achieved ? '🏆' : '🔒'}
        </div>
        <h3 className="font-bold text-sm text-gray-900 mb-1">{title}</h3>
        <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

// Import CheckCircle since I used it in the code above but it wasn't in the imports
import { CheckCircle } from 'lucide-react'
