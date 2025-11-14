import { useState, useEffect } from 'react'
import { progressAPI } from '../services/api'
import { TrendingUp, Award, Clock, Target, Flame, Trophy } from 'lucide-react'

export default function Progress() {
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
    <div className="px-4 sm:px-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Your Progress</h1>
        <p className="mt-2 text-gray-600">Track your learning journey and achievements</p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard
          icon={<Target className="h-8 w-8" />}
          title="Questions Seen"
          value={stats?.total_questions_seen || 0}
          subtitle={`${stats?.total_attempts || 0} total attempts`}
          color="blue"
        />
        <StatCard
          icon={<TrendingUp className="h-8 w-8" />}
          title="Success Rate"
          value={`${Math.round((stats?.overall_success_rate || 0) * 100)}%`}
          subtitle={`${stats?.questions_mastered || 0} mastered`}
          color="green"
        />
        <StatCard
          icon={<Flame className="h-8 w-8" />}
          title="Current Streak"
          value={stats?.current_streak || 0}
          subtitle={`Best: ${stats?.best_streak || 0}`}
          color="orange"
        />
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mastery Progress */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-purple-600" />
            Mastery Progress
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Questions Mastered</span>
                <span className="text-sm font-semibold text-gray-900">
                  {stats?.questions_mastered || 0} / {stats?.total_questions_seen || 0}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-purple-600 h-full transition-all duration-500"
                  style={{ width: `${(stats?.mastery_rate || 0) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-gray-600">Mastery Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round((stats?.mastery_rate || 0) * 100)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg. Easiness</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(stats?.average_easiness_factor || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Due for Review */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="h-6 w-6 text-blue-600" />
            Review Status
          </h2>
          <div className="space-y-4">
            <div className="text-center py-6">
              <p className="text-5xl font-bold text-blue-600 mb-2">
                {stats?.questions_due || 0}
              </p>
              <p className="text-gray-600">Questions Due for Review</p>
            </div>

            {stats?.questions_due > 0 ? (
              <button
                onClick={() => window.location.href = '/test/review'}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Start Review Session
              </button>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-800 font-medium">
                  ✅ All caught up! Great job!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Award className="h-6 w-6 text-yellow-600" />
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
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-orange-100 text-orange-600',
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className={`inline-flex p-3 rounded-lg ${colorClasses[color]}`}>
        {icon}
      </div>
      <div className="mt-4">
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-4xl font-bold text-gray-900 mt-2">{value}</p>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

function Achievement({ title, description, achieved }) {
  return (
    <div className={`p-4 rounded-lg border-2 transition ${
      achieved
        ? 'border-yellow-400 bg-yellow-50'
        : 'border-gray-200 bg-gray-50 opacity-50'
    }`}>
      <div className="text-center">
        <div className="text-3xl mb-2">
          {achieved ? '🏆' : '🔒'}
        </div>
        <h3 className="font-semibold text-sm text-gray-900 mb-1">{title}</h3>
        <p className="text-xs text-gray-600">{description}</p>
      </div>
    </div>
  )
}
