export default function canvasShortcuts(event, { undo, redo, add, remove, edit, clear, selected, editing }) {
  if (
    event.target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
    )
  )
    return
  const key = event.key.toLowerCase()
  const modifier = event.ctrlKey || event.metaKey
  let action
  if (modifier && key === 'z') action = event.shiftKey ? redo : undo
  else if (modifier && key === 'y') action = redo
  else if (!modifier && !event.altKey) {
    if (key === 'delete' || key === 'backspace') action = remove
    if (key === 'escape') action = clear
    if (key === 'enter' && selected && !event.target.closest('button'))
      action = () => edit(selected.id)
    if (key === 'n' && editing == null) action = () => add(event.shiftKey)
  }
  if (action) {
    event.preventDefault()
    action()
  }
}
