import { Link } from 'react-router-dom'

export default function ArtifactList({ artifacts, progress, open }) {
  return <>
    <h3 className="font-bold mt-6 mb-3">Artifacts</h3>
    <ul className="space-y-4">
      {artifacts.decks.map(deck => <li key={deck.id}>
        <p className="font-medium">{deck.name}</p>
        <span className="rounded bg-primary-100 text-primary-900 px-2 text-xs">{deck.kind === 'flashcards' ? 'Flashcards' : 'Quiz'}</span>
        <p className="text-sm">{deck.question_count} questions</p>
        {deck.due_count > 0 && <p className="text-sm">{deck.due_count} due</p>}
        {deck.held_back_count > 0 && <p className="text-sm">{deck.held_back_count} held back</p>}
        <div className="flex gap-3">
          <button onClick={() => open(deck.id, 'practice')}>Practise</button>
          <button onClick={() => open(deck.id, 'edit')}>Open</button>
        </div>
      </li>)}
      {artifacts.canvases.map(canvas => <li key={canvas.id}><Link to={`/canvas/${canvas.id}`}>{canvas.title}</Link></li>)}
    </ul>
    <div className="mt-6 text-sm" aria-label="Notebook progress">
      <p>{progress.answered_count} answered</p>
      <p>{progress.answered_count ? `${Math.round((progress.correct_rate || 0) * 100)}% correct` : 'No answers yet'}</p>
      <p>{progress.due_count} due</p>
    </div>
  </>
}
