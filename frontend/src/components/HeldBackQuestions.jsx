import { useEffect, useState } from 'react'
import api from '../services/api'
import { serverMessage } from '../utils/serverMessage'

export default function HeldBackQuestions({ deckId, onRestored }) {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    let active = true
    setItems([])
    setError('')
    api.get('/flagged', { params: { deck_id: deckId } }).then(response => {
      if (active) setItems(response.data)
    }).catch(err => {
      if (active) setError(serverMessage(err.originalError || err) || 'Could not load held-back questions.')
    })
    return () => { active = false }
  }, [deckId])

  const resolve = async (id, action) => {
    setBusy(id)
    setError('')
    try {
      await api.post(`/flagged/${id}/${action}`)
      setItems(current => current.filter(item => item.id !== id))
      if (action === 'restore') await onRestored()
    } catch (err) {
      setError(serverMessage(err.originalError || err) || 'Could not resolve this question.')
    } finally {
      setBusy(null)
    }
  }

  if (!items.length && !error) return null

  return (
    <section className="glass-panel bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-6 text-gray-900 dark:text-white">
      {error && <p role="alert" className="mb-4 text-red-700 dark:text-red-300">{error}</p>}
      {items.length > 0 && <>
        <h2 className="font-semibold mb-4">Held back by the quality check ({items.length})</h2>
        <div className="space-y-6">
          {items.map(item => (
            <article key={item.id} className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="font-medium mb-2">{item.card_type === 'flashcard' && <strong>Front: </strong>}{item.question}</p>
              {item.card_type === 'flashcard' ? <p><strong>Back: </strong>{item.explanation}</p> : <>
              <ul className="space-y-1 text-sm">
                {(item.options || []).map(option => (
                  <li key={option.option}>
                    {option.option}. {option.text}
                    {String(option.option).trim().toUpperCase() === String(item.correct_answer).trim().toUpperCase() &&
                      <span className="ml-2 font-semibold text-green-700 dark:text-green-300">(Keyed answer)</span>}
                  </li>
                ))}
              </ul>
              </>}
              <ul className="list-disc pl-5 mt-3 text-sm text-amber-800 dark:text-amber-200">
                {item.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
              </ul>
              <div className="flex gap-3 mt-4">
                <button type="button" aria-label={`Restore question ${item.id}`} disabled={busy !== null}
                  onClick={() => resolve(item.id, 'restore')}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50">Restore</button>
                <button type="button" aria-label={`Discard question ${item.id}`} disabled={busy !== null}
                  onClick={() => resolve(item.id, 'discard')}
                  className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">Discard</button>
              </div>
            </article>
          ))}
        </div>
      </>}
    </section>
  )
}
