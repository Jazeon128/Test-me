import { useState } from 'react'
import { Check, Layers, ListChecks } from 'lucide-react'

export default function BankRow({ item, selected, toggle, open, practise }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = item.card_type === 'flashcard' ? Layers : ListChecks
  return <li className="bank-row bank-card">
    <div className="bank-row-summary">
      <label className="bank-checkbox"><input type="checkbox" checked={selected} onChange={() => toggle(item.id)} aria-label={`Select ${item.question_text}`} /></label>
      <button className="bank-expand" aria-label={`Show details: ${item.question_text}`} aria-expanded={expanded} aria-controls={`bank-preview-${item.id}`} onClick={() => setExpanded(value => !value)}>
        <Icon size={20} aria-hidden="true" />
        <span className="bank-row-content"><span className="bank-stem">{item.question_text}</span>
          <span className="bank-meta"><span className="bank-status">{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</span>
            <span>{item.decks.map(deck => deck.name).join(', ')}</span>
            {item.tags.map(tag => <span className="bank-tag" key={tag.id}>{tag.name}</span>)}
            <span>{item.source?.name}</span>
          </span>
        </span>
      </button>
    </div>
    {expanded && <div id={`bank-preview-${item.id}`} className="bank-preview">
      {item.card_type === 'mcq' && <ul aria-label="Answer options">{item.options.map(option => <li key={option.option} className={option.is_correct ? 'bank-option-correct' : undefined}>
        {option.is_correct && <Check size={20} aria-hidden="true" />}
        {option.option}. {option.text}{option.is_correct && <strong> (Correct)</strong>}
      </li>)}</ul>}
      {item.card_type === 'flashcard' && <h3>Back</h3>}
      {item.explanation && <p>{item.explanation}</p>}
      {item.edited && <span className="bank-tag">Edited</span>}
      <div className="bank-preview-actions">
        <button disabled={!item.decks.length} onClick={() => open(item.decks[0].id, 'edit')}>Open in deck</button>
        <button onClick={() => practise([item.id])}>Practise</button>
      </div>
    </div>}
  </li>
}
