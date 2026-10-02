import { useState } from 'react'
import { notebooksAPI, tagsAPI } from '../../services/api'

export default function BankActions({ notebookId, selected, decks, tags, desktop, practise, onDone, onTag, setMessage }) {
  const [menu, setMenu] = useState('')
  const [more, setMore] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectionDecks, setSelectionDecks] = useState([])
  const ids = [...selected]
  const openMenu = async action => {
    setName('')
    setError('')
    if (action === 'delete' || action === 'remove_from_deck') {
      setBusy(true)
      try {
        let offset = 0
        let total
        const links = new Map()
        do {
          const { data } = await notebooksAPI.questions(notebookId, { offset, limit: 50 })
          data.items.forEach(item => { if (selected.has(item.id)) item.decks.forEach(deck => links.set(deck.id, deck)) })
          total = data.total
          offset += 50
        } while (offset < total)
        setSelectionDecks([...links.values()])
      } catch (err) { setError(err.message || 'Could not load selection.'); return }
      finally { setBusy(false) }
    }
    setMenu(action)
  }
  const apply = async (action, fields = {}, label = '') => {
    setBusy(true)
    setError('')
    try {
      const { data } = await notebooksAPI.bulkQuestions(notebookId, { question_ids: ids, action, ...fields })
      const verbs = { add_to_deck: 'Added', remove_from_deck: 'Removed', tag: 'Tagged', untag: 'Untagged', delete: 'Deleted' }
      const preposition = action === 'add_to_deck' ? ' to ' : action === 'remove_from_deck' ? ' from ' : ' with '
      const skipped = action === 'add_to_deck' ? `${data.skipped} were already there.` : `${data.skipped} were unchanged.`
      setMessage(`${verbs[action]} ${data.affected}${label ? preposition + label : ' items'}.${data.skipped ? ' ' + skipped : ''}`)
      setMenu('')
      setMore(false)
      await onDone(action === 'delete')
    } catch (err) { setError(err.message || 'Could not apply action.') }
    finally { setBusy(false) }
  }
  const createTag = async event => {
    event.preventDefault()
    setBusy(true)
    try {
      const { data } = await tagsAPI.create({ name: name.trim(), notebook_id: Number(notebookId) })
      onTag(data)
      await apply('tag', { tag_id: data.id }, data.name)
    } catch (err) { setError(err.message || 'Could not create tag.') }
    finally { setBusy(false) }
  }
  const actions = <>
    <button disabled={busy} onClick={() => openMenu('add_to_deck')}>Add to deck</button>
    <button disabled={busy} onClick={() => openMenu('remove_from_deck')}>Remove from deck</button>
    <button disabled={busy} onClick={() => openMenu('tag')}>Tag</button>
    <button disabled={busy} onClick={() => openMenu('untag')}>Untag</button>
    <button disabled={busy} onClick={() => openMenu('delete')}>Delete</button>
  </>
  const targets = menu === 'add_to_deck' ? decks : menu === 'remove_from_deck' ? selectionDecks.filter(deck => decks.some(local => local.id === deck.id)) : ['tag', 'untag'].includes(menu) ? tags : []
  return <section className="bank-action-bar" aria-label="Selection actions">
    <div className="bank-action-buttons"><span>Selected: {selected.size}</span>
      <button className="btn-primary" disabled={busy || ids.length > 200} onClick={() => practise(ids)}>Practise</button>
      {desktop ? actions : <><button aria-expanded={more} onClick={() => setMore(value => !value)}>More</button>{more && <div className="bank-more">{actions}</div>}</>}
    </div>
    {ids.length > 200 && <p>Choose up to 200 items to practise.</p>}
    {ids.length > 500 && <p>Choose up to 500 items for a bulk action.</p>}
    {error && <p role="alert">{error}</p>}
    {menu && <div className="bank-action-menu" aria-label={menu}>
      {menu === 'delete' ? <>
        <p>Delete {ids.length} items everywhere? This also deletes their progress and removes them from {selectionDecks.length} decks.</p>
        <button disabled={busy || ids.length > 500} onClick={() => apply('delete')}>Delete</button>
      </> : <>
        {targets.map(target => <button key={target.id} disabled={busy || ids.length > 500} onClick={() => apply(menu,
          menu.endsWith('deck') ? { deck_id: target.id } : { tag_id: target.id }, target.name)}>{target.name}</button>)}
        {menu === 'add_to_deck' && <button onClick={() => { setMenu('new-deck'); setName('') }}>New deck...</button>}
        {menu === 'tag' && <button onClick={() => { setMenu('new-tag'); setName('') }}>New tag...</button>}
        {(menu === 'new-deck' || menu === 'new-tag') && <form onSubmit={menu === 'new-tag' ? createTag : event => { event.preventDefault(); apply('add_to_deck', { new_deck_name: name.trim() }, name.trim()) }}>
          <label>{menu === 'new-deck' ? 'Deck name' : 'Tag name'}<input required maxLength={255} value={name} onChange={event => setName(event.target.value)} /></label>
          <button disabled={busy || !name.trim() || ids.length > 500}>Create and apply</button>
        </form>}
      </>}
      <button disabled={busy} onClick={() => setMenu('')}>Cancel</button>
    </div>}
  </section>
}
