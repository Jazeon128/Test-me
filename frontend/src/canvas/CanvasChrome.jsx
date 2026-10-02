import { Loader2, Wand2, Hand } from 'lucide-react'
import PropTypes from 'prop-types'

export function Generating({ step, progress }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <Loader2 size={22} className="animate-spin" style={{ color: 'var(--accent)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
        {step || 'Working'}
      </p>
      <div
        className="h-1 w-64 overflow-hidden rounded-full"
        style={{ background: 'var(--s3)' }}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progress}%`, background: 'var(--accent)' }}
        />
      </div>
    </div>
  )
}
export function EmptyState({ onExample }) {
  return (
    <div className="canvas-empty-state">
      <div className="max-w-md text-center">
        <h2 className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          What should this canvas show?
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
          The canvas picks how to draw the answer: a flowchart, an architecture diagram, a fishbone, a
          timeline. You do not choose the form, and every node traces back to the passage it came from.
        </p>
        <div className="canvas-examples">
          {[
            'How does a request flow through this?',
            'Compare the main options side by side',
            'What are the key ideas and how do they connect?',
          ].map(example => (
            <button key={example} type="button" onClick={() => onExample(example)}>
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
EmptyState.propTypes = {
  onExample: PropTypes.func.isRequired,
}
Generating.propTypes = {
  step: PropTypes.string,
  progress: PropTypes.number,
}
export function TemplateBadge({ canvas }) {
  const chosenByModel = !canvas.chosen_by_user
  const Icon = chosenByModel ? Wand2 : Hand
  const label = canvas.template_title || canvas.template
  return (
    <span
      className="flex flex-none items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
      style={{
        borderColor: 'var(--accent-line)',
        background: 'var(--accent-soft)',
        color: 'var(--accent)',
      }}
      title={canvas.chosen_by_user ? 'You chose this layout.' : 'Chosen from your question. Ask again to draw it another way.'}
    >
      <Icon size={12} />
      <span className="font-medium">Drawn as: {label}</span>
    </span>
  )
}
TemplateBadge.propTypes = {
  canvas: PropTypes.object.isRequired,
}
