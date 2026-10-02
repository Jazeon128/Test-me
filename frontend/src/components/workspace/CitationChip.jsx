import { formatPassage } from '../../utils/passage'
import { useId, useLayoutEffect, useRef, useState } from 'react'

export default function CitationChip({ citation }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({})
  const chip = useRef(null)
  const popover = useRef(null)
  const closeButton = useRef(null)
  const id = useId()
  const close = () => { setOpen(false); chip.current?.focus() }
  useLayoutEffect(() => {
    if (!open) return
    const anchor = () => {
      const rect = chip.current.getBoundingClientRect()
      const width = popover.current.offsetWidth
      const height = Math.min(240, Math.max(popover.current.offsetHeight, popover.current.scrollHeight))
      const below = window.innerHeight - rect.bottom - 6 - 8
      const above = rect.top - 6 - 8
      const opensBelow = height <= below
      const availableHeight = Math.max(0, opensBelow ? below : above)
      const visibleHeight = Math.min(height, availableHeight)
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: opensBelow ? rect.bottom + 6 : rect.top - visibleHeight - 6,
        maxHeight: Math.min(240, availableHeight),
      })
    }
    anchor()
    closeButton.current?.focus({ preventScroll: true })
    window.addEventListener('resize', anchor)
    window.addEventListener('scroll', anchor, true)
    return () => {
      window.removeEventListener('resize', anchor)
      window.removeEventListener('scroll', anchor, true)
    }
  }, [open])
  return <span className="chat-citation">
    <button ref={chip} type="button" className={`chat-chip ${citation.removed ? 'chat-chip-removed' : ''}`}
      aria-label={`Citation ${citation.n}: ${citation.display_name}, ${citation.locator}`}
      aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setOpen(!open)}>{citation.n}</button>
    {open && <span ref={popover} style={position} id={id} role="dialog" aria-label={`Citation ${citation.n}`} className="chat-popover"
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close() } }}>
      <strong>{citation.display_name}</strong>
      {citation.heading && <strong>{citation.heading}</strong>}
      <span>{citation.page != null ? `Page ${citation.page}` : citation.locator}</span>
      <span>{citation.removed ? 'This source was removed from the notebook.' : formatPassage(citation.excerpt)}</span>
      <button ref={closeButton} type="button" onClick={close}>Close citation</button>
    </span>}
  </span>
}
