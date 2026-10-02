import { Pencil } from 'lucide-react'
import PropTypes from 'prop-types'

export default function CanvasToolbar({ selected, onEdit }) {
  if (!selected) return null
  return (
    <div className="tm-edit-toolbar">
      <button type="button" onClick={() => onEdit(selected.id)} aria-label="Edit" title="Edit">
        <Pencil size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
CanvasToolbar.propTypes = { selected: PropTypes.object, onEdit: PropTypes.func.isRequired }
