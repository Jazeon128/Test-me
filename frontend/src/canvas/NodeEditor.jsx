import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'

export default function NodeEditor({ data, detail = false, note = false }) {
  const field = useRef(null)
  useEffect(() => {
    let attempts = 0
    let frame = null
    const focusField = () => {
      frame = null
      const target = field.current
      if (!target) return
      const active = document.activeElement
      if (active !== target && active?.closest(
        'input, textarea, [contenteditable]:not([contenteditable="false"])'
      )) return
      attempts++
      target.focus({ preventScroll: true })
      if (document.activeElement === target) {
        target.select()
        return
      }
      if (attempts < 30) frame = requestAnimationFrame(focusField)
    }
    frame = requestAnimationFrame(focusField)
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [])
  const [label, setLabel] = useState(data.label || '')
  useEffect(() => {
    if (!field.current) return
    field.current.style.height = 'auto'
    field.current.style.height = `${Math.min(field.current.scrollHeight, 80)}px`
  }, [label])
  const [text, setText] = useState(data.detail || '')
  const valid =
    label.trim().length > 0 && label.length <= (note ? 400 : 120) && (!detail || text.length <= 400)
  const submit = event => {
    event.preventDefault()
    if (valid) data.onSaveText({ label, ...(detail ? { detail: text } : {}) })
  }
  return (
    <form
      className="tm-editor nodrag nopan nowheel"
      style={{ minWidth: Math.max(240, data.editorWidth || 0) }}
      onSubmit={submit}
      onClick={event => event.stopPropagation()}
      onDoubleClick={event => event.stopPropagation()}
      onKeyDown={event => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          data.onCancelText()
        }
        if (event.key === 'Enter' && (note ? event.ctrlKey : event.target === field.current || !event.shiftKey)) submit(event)
      }}
    >
      <label>
        {note ? 'Text' : 'Label'}
        {note ? (
          <textarea
            ref={field}
            required
            value={label}
            aria-invalid={!label.trim() || label.length > 400}
            onChange={event => setLabel(event.target.value)}
          />
        ) : (
          <textarea
            rows={1}
            ref={field}
            required
            value={label}
            aria-invalid={!label.trim() || label.length > 120}
            onChange={event => setLabel(event.target.value)}
          />
        )}
      </label>
      {detail && (
        <label>
          Detail
          <textarea
            value={text}
            aria-invalid={text.length > 400}
            onChange={event => setText(event.target.value)}
          />
        </label>
      )}
      {!valid && (
        <p role="alert">
          {note
            ? 'Text must be 1 to 400 characters.'
            : 'Label must be 1 to 120 characters. Detail must be at most 400 characters.'}
        </p>
      )}
      <button type="submit" disabled={!valid}>
        Save
      </button>
      <button type="button" onClick={data.onCancelText}>
        Cancel
      </button>
    </form>
  )
}
NodeEditor.propTypes = {
  data: PropTypes.object.isRequired,
  detail: PropTypes.bool,
  note: PropTypes.bool,
}

export function EditedMarker({ data }) {
  return data.edited && !data.added ? (
    <span
      className="tm-edited"
      title="Edited by you. The source passage supported the original wording."
    >
      edited
    </span>
  ) : null
}
EditedMarker.propTypes = { data: PropTypes.object.isRequired }
