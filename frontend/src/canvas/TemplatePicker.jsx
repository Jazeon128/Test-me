import PropTypes from 'prop-types'
import { HelpCircle } from 'lucide-react'

/**
 * The low-confidence path.
 *
 * Shown when routing was not sure enough to choose, or is not configured at
 * all. Offering the candidates with their probabilities is more honest than
 * drawing the wrong diagram confidently, and it is the moment the person learns
 * what the other forms are.
 */
export default function TemplatePicker({ reason, candidates, onPick, busy }) {
  return (
    <div className="tm-canvas flex min-h-[420px] items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="mb-5 flex items-start gap-3">
          <HelpCircle size={20} style={{ color: 'var(--text3)', flex: 'none', marginTop: 2 }} />
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              How should this be drawn?
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text2)' }}>
              {reason}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              disabled={busy}
              onClick={() => onPick(candidate.id)}
              aria-label={`Draw this as a ${candidate.title.toLowerCase()}`}
              className="flex flex-col gap-2 rounded-lg border p-4 text-left transition disabled:opacity-50"
              style={{
                background: 'var(--chrome)',
                borderColor: 'var(--line)',
                minHeight: 132,
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {candidate.title}
                </span>
                {candidate.probability != null && (
                  <span className="tm-mono text-xs" style={{ color: 'var(--text3)' }}>
                    {Math.round(candidate.probability * 100)}%
                  </span>
                )}
              </div>
              <span className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                {candidate.description}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

TemplatePicker.propTypes = {
  reason: PropTypes.string.isRequired,
  candidates: PropTypes.arrayOf(PropTypes.object).isRequired,
  onPick: PropTypes.func.isRequired,
  busy: PropTypes.bool,
}
