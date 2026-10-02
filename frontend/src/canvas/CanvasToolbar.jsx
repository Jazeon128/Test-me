import { useState } from 'react'
import { Pencil, Plus, StickyNote, Palette, Trash2 } from 'lucide-react'
import PropTypes from 'prop-types'
import { COLORS, meaningColours } from './useCanvasEditing'

export default function CanvasToolbar({
  selected,
  edge,
  onEdit,
  onAdd,
  onDelete,
  canDelete,
  onColour,
  onLabel,
}) {
  const [menu, setMenu] = useState(false)
  const [label, setLabel] = useState(null)
  const locked = selected && meaningColours.includes(selected.type)
  const button = (name, Icon, action, disabled = false, title = name) => (
    <button type="button" onClick={action} disabled={disabled} aria-label={name} title={title}>
      <Icon size={18} aria-hidden="true" />
    </button>
  )
  return (
    <div className="tm-edit-toolbar" role="toolbar" aria-label="Canvas tools">
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
  selected: PropTypes.object,
  edge: PropTypes.object,
  onEdit: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  canDelete: PropTypes.bool.isRequired,
  onColour: PropTypes.func.isRequired,
  onLabel: PropTypes.func.isRequired,
}
