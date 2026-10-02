import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { notebooksAPI, tagsAPI } from '../../services/api'
import BankActions from './BankActions'
import BankRow from './BankRow'
import useMediaQuery from '../../hooks/useMediaQuery'

const filterKeys = ['deck_id', 'source_id', 'tag_id', 'card_type', 'difficulty', 'status']
const emptyOptions = {
  deck_id: 'All decks', source_id: 'All sources', tag_id: 'All tags',
  card_type: 'All types', difficulty: 'Any difficulty', status: 'Any status',
}
const capitalise = value => value.charAt(0).toUpperCase() + value.slice(1)

function Search({ value, change }) {
  const [draft, setDraft] = useState(value)
  const latest = useRef(change)
  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { latest.current = change }, [change])
  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => latest.current(draft), 250)
    return () => clearTimeout(timer)
  }, [draft, value])
  return <label className="bank-search">Search
    <input type="search" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Search all items" />
  </label>
}

export default function QuestionBank({ notebookId, workspace, open, selected: controlledSelected, setSelected: controlledSetSelected, practise, refreshWorkspace }) {
  const [params, setParams] = useSearchParams()
  const desktop = useMediaQuery('(min-width: 768px)')
  const [result, setResult] = useState(null)
  const [held, setHeld] = useState([])
  const [tags, setTags] = useState([])
  const [error, setError] = useState('')
  const [localSelected, localSetSelected] = useState(new Set())
  const selected = controlledSelected ?? localSelected
  const setSelected = controlledSetSelected ?? localSetSelected
  const [revision, setRevision] = useState(0)
  const [actionMessage, setActionMessage] = useState('')
  const query = params.toString()
  const heldTab = params.get('bank_tab') === 'held-back'
  const filtered = Boolean(params.get('q') || filterKeys.some(key => params.get(key)))
  useEffect(() => {
    let alive = true
    Promise.all([notebooksAPI.heldBack(notebookId), tagsAPI.list(notebookId)]).then(([heldResult, tagResult]) => {
      if (alive) { setHeld(heldResult.data); setTags(tagResult.data) }
    }).catch(err => { if (alive) setError(err.message || 'Could not load question bank.') })
    return () => { alive = false }
  }, [notebookId])
  useEffect(() => {
    let alive = true
    const current = new URLSearchParams(query)
    const filters = Object.fromEntries(filterKeys.filter(key => current.get(key)).map(key => [key, current.get(key)]))
    setResult(null)
    notebooksAPI.questions(notebookId, { ...filters, search: current.get('q') || undefined,
      offset: Number(current.get('offset')) || 0, limit: 50 }).then(({ data }) => {
      if (alive) { setResult(data); setError('') }
    }).catch(err => { if (alive) setError(err.message || 'Could not load question bank.') })
    return () => { alive = false }
  }, [notebookId, query, revision])
  const change = (key, value) => setParams(current => {
    const next = new URLSearchParams(current)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'offset') next.delete('offset')
    return next
  })
  const clear = () => setParams(current => {
    const next = new URLSearchParams(current)
    ;['q', ...filterKeys, 'offset'].forEach(key => next.delete(key))
    return next
  })
  const toggle = id => setSelected(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const pageIds = result?.items.map(item => item.id) || []
  const allPage = pageIds.length > 0 && pageIds.every(id => selected.has(id))
  const selectPage = () => setSelected(current => {
    const next = new Set(current)
    pageIds.forEach(id => { if (allPage) next.delete(id); else next.add(id) })
    return next
  })
  const selects = [
    ['deck_id', 'Deck', workspace.artifacts.decks.map(deck => [deck.id, deck.name])],
    ['source_id', 'Source', workspace.sources.map(source => [source.id, source.display_name])],
    ['tag_id', 'Tag', tags.map(tag => [tag.id, `${tag.name}${tag.shared ? ' (shared)' : ''}`])],
    ['card_type', 'Type', [['mcq', 'Questions'], ['flashcard', 'Flashcards']]],
    ['difficulty', 'Difficulty', ['easy', 'medium', 'hard'].map(value => [value, capitalise(value)])],
    ['status', 'Status', ['due', 'new', 'learning', 'mastered'].map(value => [value, capitalise(value)])],
  ]
  return <div className="question-bank">
    <div role="tablist" aria-label="Question bank tabs" className="bank-tabs">
      <button role="tab" aria-selected={!heldTab} onClick={() => change('bank_tab', '')}>All items</button>
      <button role="tab" aria-selected={heldTab} onClick={() => change('bank_tab', 'held-back')}>Held back ({held.length})</button>
    </div>
    {error && <p role="alert">{error}</p>}
    <p role="status" aria-live="polite">{actionMessage}</p>
    {heldTab ? <section aria-label="Held back items">
      <p>Restore or discard held back items in the deck editor.</p>
      {held.length === 0 && <p>No held back items.</p>}
      <ul>{held.map(item => <li key={item.id} className="bank-held">
        <h2>{item.question_text}</h2><p>{item.reasons.join(', ')}</p>
        <p>{item.source?.name}</p>
        {item.deck && <button onClick={() => open(item.deck.id, 'edit')}>Open in deck: {item.deck.name}</button>}
      </li>)}</ul>
    </section> : <>
      <div className="bank-toolbar">
        <Search value={params.get('q') || ''} change={value => change('q', value)} />
        <details className="bank-filters" open={desktop || undefined}><summary>Filters</summary><div className="bank-filter-fields">
          {selects.map(([key, label, options]) => <label key={key}>{label}
            <select aria-label={label} value={params.get(key) || ''} onChange={event => change(key, event.target.value)}>
              <option value="">{emptyOptions[key]}</option>
              {options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
            </select>
          </label>)}
        </div></details>
        {filtered && <button onClick={clear}>Clear filters</button>}
      </div>
      <div className="bank-selection">
        <label><input type="checkbox" aria-label="Select this page" checked={allPage} disabled={!pageIds.length} onChange={selectPage} />Select this page</label>
        <span aria-live="polite">{selected.size} selected</span>
        {selected.size > 0 && <button onClick={() => setSelected(new Set())}>Clear selection</button>}
      </div>
      {!result && !error && <p role="status">Loading items...</p>}
      {result?.total === 0 && <p>{filtered ? 'No items match these filters.' : 'Nothing yet. Generate a quiz or flashcards from the Studio.'}</p>}
      <ul aria-label={`Questions in ${workspace.notebook.name}`} className="bank-list">
        {result?.items.map(item => <BankRow key={item.id} item={item} selected={selected.has(item.id)} toggle={toggle} open={open} practise={practise} />)}
      </ul>
      {result && <div className="bank-pagination">
        <span>Showing {result.items.length ? result.offset + 1 : 0} to {result.offset + result.items.length} of {result.total}</span>
        <button disabled={result.offset === 0} onClick={() => change('offset', String(Math.max(0, result.offset - 50)))}>Previous</button>
        <button disabled={result.offset + result.limit >= result.total} onClick={() => change('offset', String(result.offset + result.limit))}>Next</button>
      </div>}
      {selected.size > 0 && <BankActions notebookId={notebookId} selected={selected} setMessage={setActionMessage}
        decks={workspace.artifacts.decks} tags={tags} desktop={desktop} practise={practise}
        onDone={async deleted => { if (deleted) setSelected(new Set()); setRevision(value => value + 1); await refreshWorkspace?.() }}
        onTag={tag => setTags(current => [...current, tag])} />}
    </>}
  </div>
}
