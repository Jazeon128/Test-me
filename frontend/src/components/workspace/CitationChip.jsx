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
      const height = popover.current.offsetHeight
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: Math.max(8, Math.min(rect.bottom + height + 8 > window.innerHeight
          ? rect.top - height - 8 : rect.bottom + 8, window.innerHeight - height - 8)),
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
      <span>{citation.locator}</span>
      <span>{citation.removed ? 'This source was removed from the notebook.' : citation.excerpt}</span>
      <button ref={closeButton} type="button" onClick={close}>Close citation</button>
    </span>}
  </span>
}
