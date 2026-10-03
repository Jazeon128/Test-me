import { canvasTitle } from '../../canvas/canvasTitle'
import { Layers, ListChecks, Network } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { serverMessage } from '../../utils/serverMessage'

export default function ArtifactList({ artifacts, progress, open, notebookId, onOpenCanvas, onDeleteCanvas }) {
  const [confirmId, setConfirmId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [errors, setErrors] = useState({})
  const cancel = useRef(null)
  useEffect(() => { if (confirmId !== null) cancel.current?.focus() }, [confirmId])
  const deleteCanvas = async id => {
    setBusyId(id)
    setErrors(current => ({ ...current, [id]: '' }))
    try {
      await onDeleteCanvas(id)
      setConfirmId(null)
    } catch (error) {
      setErrors(current => ({ ...current, [id]: serverMessage(error) || error.message || 'Canvas could not be deleted.' }))
    } finally { setBusyId(null) }
  }
  const groups = [
    { title: 'Quizzes', items: artifacts.decks.filter(deck => deck.kind !== 'flashcards') },
    { title: 'Flashcards', items: artifacts.decks.filter(deck => deck.kind === 'flashcards') },
  ]
  return <>
    <section aria-labelledby="notebook-progress-heading" className="workspace-progress mt-6">
      <h3 id="notebook-progress-heading" className="font-bold mb-3">Notebook progress</h3>
      <dl>
        <div><dt>Answered</dt><dd>{progress.answered_count || 0}</dd></div>
        <div><dt>Correct</dt><dd>{progress.answered_count ? `${Math.round((progress.correct_rate || 0) * 100)}%` : '–'}</dd></div>
        <div><dt>Due</dt><dd>{progress.due_count || 0}</dd></div>
      </dl>
    </section>
    {groups.filter(group => group.items.length).map(group => <section key={group.title}>
      <h3 className="font-bold mt-6 mb-3">{group.title} ({group.items.length})</h3>
      <ul className="space-y-4">
      {group.items.map(deck => <li key={deck.id} className="workspace-artifact">
        {deck.kind === 'flashcards' ? <Layers aria-hidden="true" size={20} /> : <ListChecks aria-hidden="true" size={20} />}
        <p className="font-medium">{deck.name}</p>
        <p className="workspace-artifact-meta">{deck.question_count} {deck.kind === 'flashcards' ? 'cards' : 'questions'} &middot; {deck.due_count || 0} due</p>
        {deck.held_back_count > 0 && <p className="text-sm">{deck.held_back_count} held back</p>}
        <div className="flex gap-3">
          <button className="btn-primary workspace-small-button" onClick={event => open(deck.id, 'practice', event.currentTarget)}>Practise</button>
          <button className="btn-secondary workspace-small-button" onClick={event => open(deck.id, 'edit', event.currentTarget)}>Open</button>
        </div>
      </li>)}
      </ul>
    </section>)}
    {artifacts.canvases.length > 0 && <section>
      <h3 className="font-bold mt-6 mb-3">Canvases ({artifacts.canvases.length})</h3>
      <ul className="space-y-4">
        {artifacts.canvases.map(canvas => <li key={canvas.id} className="workspace-artifact"><Network aria-hidden="true" size={20} /><Link to={`/notebooks/${notebookId}?view=canvas&canvas=${canvas.id}`} onClick={event => {
          if (onOpenCanvas && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
            event.preventDefault()
            onOpenCanvas(canvas.id, event.currentTarget)
          }
        }}><span className="sr-only">Open </span>{canvasTitle(canvas.title)}</Link>
          {confirmId === canvas.id ? <div>
            <p>Delete this canvas? Its quiz deck stays.</p>
            <button className="btn-secondary workspace-small-button" disabled={busyId !== null} onClick={() => deleteCanvas(canvas.id)}>Delete canvas</button>
            <button ref={cancel} className="btn-secondary workspace-small-button" disabled={busyId !== null} onClick={() => setConfirmId(null)}>Cancel</button>
          </div> : <button className="btn-secondary workspace-small-button" aria-label={`Delete canvas ${canvasTitle(canvas.title)}`} disabled={busyId !== null} onClick={() => setConfirmId(canvas.id)}>Delete</button>}
          {errors[canvas.id] && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{errors[canvas.id]}</p>}
        </li>)}
      </ul>
    </section>}
    {!artifacts.decks.length && !artifacts.canvases.length && <p className="mt-6">Nothing made yet. Tick sources and choose Quiz, Flashcards or Canvas.</p>}
  </>
}
