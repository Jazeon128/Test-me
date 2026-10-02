import { useEffect, useRef, useState } from 'react'
import { Pencil, Plus, StickyNote, Palette, Trash2, Undo2, Redo2, Keyboard, FileText } from 'lucide-react'
import PropTypes from 'prop-types'
import { COLORS, meaningColours } from './useCanvasEditing'

export default function CanvasToolbar({
  undo,
  redo,
  canUndo,
  canRedo,
  selected,
  edge,
  onEdit,
  onSource,
  onAdd,
  onDelete,
  canDelete,
  onColour,
  onLabel,
}) {
  const [menu, setMenu] = useState(false)
  const [label, setLabel] = useState(null)
  const [help, setHelp] = useState(false)
  const helpButton = useRef(null)
  const closeButton = useRef(null)
  useEffect(() => {
    setMenu(false)
    setLabel(null)
  }, [selected?.id, edge?.id])
  useEffect(() => {
    if (help) closeButton.current?.focus()
  }, [help])
  const closeHelp = () => {
    setHelp(false)
    helpButton.current?.focus()
  }
  const locked = selected && meaningColours.includes(selected.type)
  const button = (name, Icon, action, disabled = false, title = name) => (
    <button type="button" onClick={action} disabled={disabled} aria-label={name} title={title}>
      <Icon size={18} aria-hidden="true" />
    </button>
  )
  return (
    <div
      className="tm-edit-toolbar"
      role="toolbar"
      aria-label="Canvas tools"
      onKeyDown={event => {
        if (event.key === 'Escape') {
          setMenu(false)
          setLabel(null)
          if (help) {
            event.stopPropagation()
            closeHelp()
          }
        }
      }}
    >
      {button('Undo', Undo2, undo, !canUndo)}
      {button('Redo', Redo2, redo, !canRedo)}
      <button
        type="button"
        ref={helpButton}
        aria-label="Keyboard shortcuts"
        aria-expanded={help}
        onClick={() => (help ? closeHelp() : setHelp(true))}
      >
        <Keyboard size={18} aria-hidden="true" />
      </button>
      {help && (
        <div className="tm-shortcuts" role="dialog" aria-label="Keyboard shortcuts">
          <p>Keyboard shortcuts</p>
          <dl>
            <dt>Ctrl+Z / Cmd+Z</dt>
            <dd>Undo</dd>
            <dt>Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y</dt>
            <dd>Redo</dd>
            <dt>Delete / Backspace</dt>
            <dd>Delete selection</dd>
            <dt>Enter</dt>
            <dd>Edit selection</dd>
            <dt>Escape</dt>
            <dd>Clear selection and close menus</dd>
            <dt>N</dt>
            <dd>Add node</dd>
            <dt>Shift+N</dt>
            <dd>Add note</dd>
          </dl>
          <button type="button" ref={closeButton} onClick={closeHelp}>
            Close
          </button>
        </div>
      )}
      {button('Source', FileText, onSource, !selected?.data.source_section_id || Boolean(selected?.data.added) || selected?.type === 'MatrixHeader')}
      {button('Add node', Plus, () => onAdd(false))}
      {button('Add note', StickyNote, () => onAdd(true))}
      {selected && (
        <>
          {button('Edit', Pencil, () => onEdit(selected.id))}
          {button(
            'Colour',
            Palette,
            () => setMenu(!menu),
            Boolean(locked),
            locked ? 'Colour comes from this node’s meaning.' : 'Colour'
          )}
          {menu && !locked && (
            <div role="menu" aria-label="Node colour" className="tm-colour-menu">
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  role="menuitemradio"
                  className={`c-${color}`}
                  aria-label={color}
                  title={color}
                  aria-checked={(selected.data.color || 'slate') === color}
                  onClick={() => {
                    onColour(color)
                    setMenu(false)
                  }}
                >
                  <span className="tm-colour-swatch" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {edge && (
        <>
          {button('Edit label', Pencil, () => setLabel(edge.label || ''))}
          {label !== null && (
            <input
              autoFocus
              aria-label="Edge label"
              value={label}
              maxLength={80}
              onChange={event => setLabel(event.target.value)}
              onKeyDown={event => {
                event.stopPropagation()
                if (event.key === 'Enter') {
                  onLabel(label)
                  setLabel(null)
                }
                if (event.key === 'Escape') setLabel(null)
              }}
            />
          )}
        </>
      )}
      {(selected || edge) &&
        button(
          'Delete',
          Trash2,
          onDelete,
          Boolean(selected && !canDelete),
          selected && !canDelete ? 'Delete what is inside it first.' : 'Delete'
        )}
    </div>
  )
}
CanvasToolbar.propTypes = {
  undo: PropTypes.func.isRequired,
  redo: PropTypes.func.isRequired,
  canUndo: PropTypes.bool.isRequired,
  canRedo: PropTypes.bool.isRequired,
  selected: PropTypes.object,
  edge: PropTypes.object,
  onEdit: PropTypes.func.isRequired,
  onSource: PropTypes.func,
  onAdd: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  canDelete: PropTypes.bool.isRequired,
  onColour: PropTypes.func.isRequired,
  onLabel: PropTypes.func.isRequired,
}
