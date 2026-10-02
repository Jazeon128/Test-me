import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { Loader2 } from 'lucide-react'

export default function GenerationProgress({ status }) {
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
          <h3 className="font-bold text-gray-900 dark:text-white text-lg">Generating {status.kind === 'flashcards' ? 'cards' : 'questions'}</h3>
          <p className="text-primary-600 dark:text-primary-300 font-medium">{status.current_step}</p>
          {total > 0 && <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{status.kind === 'flashcards' ? 'Cards' : 'Section'} {done} of {total}</p>}
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
    kind: PropTypes.string,
    current_step: PropTypes.string,
    current_question: PropTypes.number,
    total_questions: PropTypes.number,
    started_at: PropTypes.string,
  }).isRequired,
}

