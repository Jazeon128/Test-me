import { useEffect, useRef, useState } from 'react'

const ratings = [
  { label: 'Again', quality: 1 },
  { label: 'Hard', quality: 3 },
  { label: 'Good', quality: 4 },
  { label: 'Easy', quality: 5 },
]

export default function FlashcardCard({ question, onRate, submitting, error }) {
  const [revealed, setRevealed] = useState(false)
  const revealButton = useRef(null)
  const goodButton = useRef(null)

  useEffect(() => {
    if (revealed) goodButton.current?.focus()
    else revealButton.current?.focus()
  }, [revealed])

  useEffect(() => {
    const handleKey = (event) => {
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"]') ||
          event.altKey || event.ctrlKey || event.metaKey || event.repeat || submitting) return
      if (!revealed && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault()
        setRevealed(true)
      } else if (revealed && /^[1-4]$/.test(event.key)) {
        event.preventDefault()
        onRate(ratings[Number(event.key) - 1].quality)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [revealed, onRate, submitting])

  return (
    <section className="flashcard-card glass-panel" aria-label="Flashcard">
      <div key={revealed ? 'back' : 'front'} className="flashcard-face">
        <span className="flashcard-label">Front</span>
        <h2 className={revealed ? 'flashcard-front-small' : 'flashcard-front'}>{question.question_text}</h2>
        {revealed && <div className="flashcard-back"><span className="flashcard-label">Back</span><p>{question.explanation}</p></div>}
      </div>
      {question.source_reference?.passage && <details className="mt-4">
        <summary className="flashcard-button">Source passage</summary>
        <p>{question.source_reference.passage}</p>
      </details>}
      {error && <p role="alert">{error}</p>}
      {revealed ? <div className="flashcard-ratings">
        {ratings.map(({ label, quality }, index) => <button key={quality}
          ref={quality === 4 ? goodButton : undefined} className="flashcard-button"
          disabled={submitting} onClick={() => onRate(quality)} aria-label={`${label}, key ${index + 1}`}>
          {label} <kbd>· {index + 1}</kbd>
        </button>)}
      </div> : <button ref={revealButton} className="flashcard-button flashcard-reveal" onClick={() => setRevealed(true)}>Show answer</button>}
    </section>
  )
}
