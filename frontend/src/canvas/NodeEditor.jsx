import { useState } from 'react'
import PropTypes from 'prop-types'

export default function NodeEditor({ data, detail = false }) {
  const [label, setLabel] = useState(data.label || '')
  const [text, setText] = useState(data.detail || '')
  const valid = label.trim().length > 0 && label.length <= 120 && (!detail || text.length <= 400)
  const submit = event => {
    event.preventDefault()
    if (valid) data.onSaveText({ label, ...(detail ? { detail: text } : {}) })
  }
  return (
    <form
      className="tm-editor nodrag nopan nowheel"
      onSubmit={submit}
      onClick={event => event.stopPropagation()}
      onDoubleClick={event => event.stopPropagation()}
      onKeyDown={event => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          data.onCancelText()
        }
        if (event.key === 'Enter' && !event.shiftKey) submit(event)
      }}
    >
      <label>
        Label
        <input
          autoFocus
          required
          value={label}
          aria-invalid={!label.trim() || label.length > 120}
          onChange={event => setLabel(event.target.value)}
        />
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
        <p role="alert">Label must be 1 to 120 characters. Detail must be at most 400 characters.</p>
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
NodeEditor.propTypes = { data: PropTypes.object.isRequired, detail: PropTypes.bool }

export function EditedMarker({ data }) {
  return data.edited ? (
    <span className="tm-edited" title="Edited by you. The source passage supported the original wording.">
      edited
    </span>
  ) : null
}
EditedMarker.propTypes = { data: PropTypes.object.isRequired }
