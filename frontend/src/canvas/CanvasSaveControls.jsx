import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import PropTypes from 'prop-types'

export default function CanvasSaveControls({
  status,
  retry,
  restore,
  restoring,
  setRestoring,
  hasChanges,
}) {
  const [keepTrigger, setKeepTrigger] = useState(false)
  const trigger = useRef(null)
  const confirm = useRef(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (restoring) confirm.current?.focus()
    else if (wasOpen.current) trigger.current?.focus()
    wasOpen.current = restoring
  }, [restoring])
  const Icon = status === 'Saved' ? Check : status === 'Saving...' ? Loader2 : AlertCircle
  return (
    <>
      {import.meta.env.VITE_DEMO === 'true' ? <span>Changes stay in this tab. The demo does not save.</span> : <span className="tm-save-status" aria-live="polite">
        <Icon
          size={16}
          aria-hidden="true"
          className={status === 'Saving...' ? 'animate-spin' : undefined}
        />
        {status}
      </span>}
      {status === 'Save failed' && (
        <button type="button" className="btn-secondary" onClick={restoring ? restore : retry}>
          Retry
        </button>
      )}
      <div className="tm-restore-anchor">
        {(hasChanges || keepTrigger) && (
          <button
            type="button"
            className="btn-secondary"
            ref={trigger}
            onClick={() => {
              setKeepTrigger(true)
              setRestoring(true)
            }}
          >
            Restore original
          </button>
        )}
        {restoring && (
          <div
            className="tm-restore"
            style={{ position: 'absolute' }}
            role="dialog"
            aria-label="Restore original"
            onKeyDown={event => {
              if (event.key === 'Escape') { event.stopPropagation(); setRestoring(false) }
            }}
          >
            <p>
              Restore the generated diagram? Your edits and positions on this canvas will be lost.
            </p>
            <button type="button" className="tm-danger" ref={confirm} onClick={restore}>
              Restore
            </button>
            <button type="button" className="btn-secondary" onClick={() => setRestoring(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </>
  )
}
CanvasSaveControls.propTypes = {
  hasChanges: PropTypes.bool.isRequired,
  status: PropTypes.string.isRequired,
  retry: PropTypes.func.isRequired,
  restore: PropTypes.func.isRequired,
  restoring: PropTypes.bool.isRequired,
  setRestoring: PropTypes.func.isRequired,
}
