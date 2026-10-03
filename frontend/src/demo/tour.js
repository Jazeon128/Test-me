import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import './tour.css'

const notebook = '/notebooks/1'
export const tourSteps = [
  [notebook, null, 'Welcome to Test Me', 'This demo notebook was built from one source about the learning pyramid. Test Me turns your own documents into practice, chat and diagrams.'],
  [notebook, 'sources', 'Your sources', 'Everything comes from the sources you add. Tick which ones chat and practice use.'],
  [notebook, 'mastery', 'Mastery by topic', 'Each section of your sources is a topic. Levels go from Attempted to Mastered as you answer correctly.'],
  [notebook, 'chat', 'Grounded chat', 'Ask about your sources. Answers cite the passage they came from. Your questions sit on the right.'],
  [notebook, 'chat-mode', 'Tutor me', 'Switch to Tutor me to be guided with questions instead of given the answer.'],
  [notebook, 'studio', 'Studio', 'Make question decks, flashcards and canvases from your sources. Everything you make is listed here.'],
  [notebook, 'questions', 'Question bank', 'Every question in this notebook, with filters, tags and selection practice.'],
  ['/canvas/3', 'canvas', 'Canvas', 'Test Me draws your source as a diagram. Click a shape to see its passage and questions.'],
  [notebook, 'hint', 'Practice with hints', 'Stuck? A hint points to the right section, then the passage, without giving the answer away.'],
  ['/review', 'review', 'Review', 'Questions come back on a spaced schedule, so you review just before you would forget.'],
  ['/review', 'get-test-me', 'Get Test Me', 'Run Test Me on your own computer to use your own documents.'],
]

export function markTourSeen() {
  try { localStorage.setItem('test-me.tourSeen', 'true') } catch { /* Storage is optional. */ }
}

export async function waitForAnchor(id, { timeout = 5000, active = () => true } = {}) {
  if (!id) return undefined
  const deadline = Date.now() + timeout
  do {
    if (!active()) return undefined
    const element = document.querySelector(`[data-tour="${id}"]`)
    if (element && !element.closest('[hidden]')) return element
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await new Promise(resolve => setTimeout(resolve, Math.min(50, remaining)))
  } while (Date.now() < deadline)
  return undefined
}

export function startTour(navigate, trigger, onClose = () => {}) {
  markTourSeen()
  let index = 0
  let generation = 0
  let closed = false
  let pending = false
  const close = () => {
    if (closed) return
    closed = true
    generation++
    markTourSeen()
    document.removeEventListener('keydown', keyboard, true)
    tour.destroy()
    const target = trigger?.isConnected ? trigger : document.querySelector('[data-tour="start"]')
    target?.focus()
    onClose()
  }
  const tour = driver({
    animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    smoothScroll: false,
    allowKeyboardControl: false,
    disableActiveInteraction: true,
    popoverClass: 'test-me-tour',
    showButtons: ['previous', 'next', 'close'],
    onDestroyStarted: close,
    onCloseClick: close,
    onNextClick: () => index === tourSteps.length - 1 ? close() : show(index + 1),
    onPrevClick: () => show(Math.max(0, index - 1)),
    onPopoverRender: popover => {
      popover.wrapper.tabIndex = -1
      popover.wrapper.setAttribute('role', 'dialog')
      popover.wrapper.setAttribute('aria-modal', 'true')
      popover.closeButton.setAttribute('aria-label', 'Close tour')
      popover.previousButton.disabled = index === 0
      popover.wrapper.focus()
    },
  })
  async function show(next) {
    if (closed || pending) return
    pending = true
    index = next
    const current = ++generation
    const active = () => !closed && generation === current
    const deadline = Date.now() + 5000
    const wait = id => waitForAnchor(id, { active, timeout: Math.max(0, deadline - Date.now()) })
    const [route, anchor, title, description] = tourSteps[index]
    // Clear the previous highlight before its route unmounts.
    if (tour.isActive()) tour.highlight({ popover: { title: 'Loading…', description: 'Opening the next view.' } })
    navigate(route)
    let id = anchor
    if (window.innerWidth < 1024 && ['sources', 'studio'].includes(id)) id += '-button'
    if (anchor === 'hint') {
      const topics = await wait('topics')
      if (active() && topics?.getAttribute('aria-expanded') === 'false') topics.click()
      const practice = await wait('topic-practice')
      if (active()) practice?.click()
    } else if (['sources', 'studio'].includes(id)) {
      const panel = await wait(id)
      if (active()) panel?.querySelector(`[aria-label="Expand ${id}"]`)?.click()
    }
    const element = await wait(id)
    pending = false
    if (!active()) return
    tour.highlight({ element, popover: {
      title, description, showButtons: ['previous', 'next', 'close'],
      showProgress: true, progressText: `${index + 1} of ${tourSteps.length}`,
      prevBtnText: 'Back', nextBtnText: index === tourSteps.length - 1 ? 'Finish' : 'Next',
    } })
  }
  function keyboard(event) {
    if (!['Escape', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.key === 'Escape') close()
    else if (event.key === 'ArrowLeft') show(Math.max(0, index - 1))
    else if (index === tourSteps.length - 1) close()
    else show(index + 1)
  }
  document.addEventListener('keydown', keyboard, true)
  void show(0)
  return close
}
