import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

const focusable = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'

export default function WorkspaceDrawer({ side, onClose, children }) {
  const dialog = useRef(null)
  const close = useRef(onClose)
  close.current = onClose
  // Read the opener during the first render. By the time effects run, the top bar
  // is inert and the browser has already moved focus from its button to the body.
  const [opener] = useState(() => document.activeElement)
  useEffect(() => {
    const element = dialog.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.querySelector('button').focus()
    const keepFocus = event => {
      if (!element.contains(event.target)) element.querySelector('button').focus()
    }
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab') return
      const items = [...element.querySelectorAll(focusable)].filter(item => !item.closest('[hidden]'))
      const first = items[0]
      const last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    document.addEventListener('focusin', keepFocus)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', keydown)
      document.removeEventListener('focusin', keepFocus)
      // The opener sits in an inert top bar until this render commits. Browsers
      // refuse focus on inert elements (jsdom does not), so wait one tick. Skip it
      // when the action that closed the drawer already moved focus (an opened deck).
      setTimeout(() => {
        const idle = !document.activeElement || document.activeElement === document.body
        if (idle && opener?.isConnected) opener.focus()
      }, 0)
    }
  }, [opener])
  const name = side === 'sources' ? 'Sources' : 'Studio'
  return <div className="workspace-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-label={name} className={`workspace-drawer workspace-drawer-${side}`}>
      <button className="icon-button workspace-drawer-close" aria-label={`Close ${side}`} onClick={onClose}><X aria-hidden="true" size={20} /></button>
      {children}
    </div>
  </div>
}
