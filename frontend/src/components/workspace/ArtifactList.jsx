import { Layers, ListChecks, Network } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ArtifactList({ artifacts, progress, open, notebookId, onOpenCanvas }) {
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
        }}><span className="sr-only">Open </span>{canvas.title}</Link></li>)}
      </ul>
    </section>}
    {!artifacts.decks.length && !artifacts.canvases.length && <p className="mt-6">Nothing made yet. Tick sources and choose Quiz, Flashcards or Canvas.</p>}
  </>
}
