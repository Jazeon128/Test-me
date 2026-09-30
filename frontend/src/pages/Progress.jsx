import Spinner from '../components/Spinner'
import { serverMessage } from '../utils/serverMessage'
import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import { progressAPI, activityAPI } from '../services/api'
import HeatMap from '../components/HeatMap'
import Mascot from '../components/Mascot'
import { TrendingUp, Award, Clock, Target, Flame, Trophy } from 'lucide-react'

export default function Progress() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState(null)
  const [awards, setAwards] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [statsResponse, activityResponse, awardsResponse] = await Promise.all([
        progressAPI.getStats(),
        activityAPI.get(),
        activityAPI.awards(),
      ])
      setStats(statsResponse.data)
      setActivity(activityResponse.data)
      setAwards(awardsResponse.data)
    } catch (error) {
      setLoadError(serverMessage(error.originalError || error) || 'Failed to load progress.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner aria-label="Loading progress" className="h-12 w-12" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <p role="alert">{loadError}</p>
        <button className="btn-primary" onClick={loadStats}>Try again</button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pb-12">
      <div className="mb-8">
        <h1 className="mb-6 text-3xl font-bold text-gray-900 dark:text-white">Your progress</h1>

        <div className="glass-panel rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-6">
            <Mascot mood={activity?.mood} />
            <div className="flex gap-8 text-sm">
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {activity?.longest_streak ?? 0}
                </div>
                <div className="text-gray-500 dark:text-gray-400">longest run</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {activity?.totals?.points ?? 0}
                </div>
                <div className="text-gray-500 dark:text-gray-400">points</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {activity?.totals?.canvases_created ?? 0}
                </div>
                <div className="text-gray-500 dark:text-gray-400">canvases</div>
              </div>
            </div>
          </div>

          <HeatMap days={activity?.heatmap} />
        </div>
      </div>


      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          icon={<Target className="h-8 w-8" />}
          title="Questions seen"
          value={stats?.total_questions_seen || 0}
          subtitle={`${stats?.total_attempts || 0} total attempts`}
          color="primary"
        />
        <StatCard
          icon={<TrendingUp className="h-8 w-8" />}
          title="Success rate"
          value={`${Math.round((stats?.overall_success_rate || 0) * 100)}%`}
          subtitle={`${stats?.questions_mastered || 0} mastered`}
          color="success"
        />
        <StatCard
          icon={<Flame className="h-8 w-8" />}
          title="Current streak"
          value={stats?.current_streak || 0}
          subtitle={`Best: ${stats?.best_streak || 0}`}
          color="warning"
        />
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Mastery Progress */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary-600 dark:text-primary-300" />
            Mastery progress
          </h2>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Questions Mastered</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {stats?.questions_mastered || 0} / {stats?.total_questions_seen || 0}
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary-600 h-full transition-all duration-1000 ease-out"
                  style={{ width: `${(stats?.mastery_rate || 0) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-gray-100">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Mastery Rate</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {Math.round((stats?.mastery_rate || 0) * 100)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Avg. Easiness</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {(stats?.average_easiness_factor || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Due for Review */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary-600 dark:text-primary-300" />
            Review status
          </h2>
          <div className="space-y-6">
            <div className="text-center py-4">
              <p className="text-6xl font-bold text-primary-600 dark:text-primary-300 mb-2 tracking-tight">
                {stats?.questions_due || 0}
              </p>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Questions Due for Review</p>
            </div>

            {stats?.questions_due > 0 ? (
              <button
                onClick={() => navigate('/practice')}
                className="w-full btn-primary py-3 text-lg shadow-lg shadow-primary-500/20"
              >
                Start Review Session
              </button>
            ) : (
              <div className="bg-success-50 dark:bg-success-900/30 border border-success-100 rounded-xl p-4 text-center">
                <p className="text-success-800 dark:text-success-200 font-bold flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  All caught up! Great job!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Awards come from the server now: earned once, stored, and shown with
          the locked ones after them. The previous block computed a parallel set
          in the browser, so the page had two competing award systems. */}
      <div className="mt-8 card">
        <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
          <Award className="h-6 w-6 text-yellow-500" />
          Awards
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {awards?.earned?.map((award) => (
            <AwardCard key={award.code} award={award} earned />
          ))}
          {awards?.locked?.map((award) => (
            <AwardCard key={award.code} award={award} />
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, title, value, subtitle, color }) {
  const colorStyles = {
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300',
    success: 'bg-success-100 dark:bg-success-900/30 text-success-600',
    warning: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600',
  }

  return (
    <div className="card hover:shadow-md transition-shadow duration-200 group">
      <div className={`inline-flex p-3 rounded-xl transition-transform duration-300 group-hover:scale-110 ${colorStyles[color] || colorStyles.primary}`}>
        {icon}
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
        <p className="text-4xl font-bold text-gray-900 dark:text-white mt-2 tracking-tight">{value}</p>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

// Import CheckCircle since I used it in the code above but it wasn't in the imports
import { CheckCircle } from 'lucide-react'

function AwardCard({ award, earned }) {
  return (
    <div
      className={`rounded-lg border p-4 text-center ${
        earned
          ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/30'
          : 'border-gray-200 bg-gray-50 dark:bg-gray-800 opacity-60 dark:border-gray-700 dark:bg-gray-800'
      }`}
    >
      <div className="mb-1 text-2xl" aria-hidden="true">
        {earned ? '\u{1F3C6}' : '\u{1F512}'}
      </div>
      <div className="text-sm font-medium text-gray-900 dark:text-white">{award.title}</div>
      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        {earned ? award.detail : award.description}
      </div>
    </div>
  )
}

AwardCard.propTypes = {
  award: PropTypes.object.isRequired,
  earned: PropTypes.bool,
}
