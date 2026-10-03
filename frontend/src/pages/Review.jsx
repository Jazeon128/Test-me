import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PracticeSession from '../components/PracticeSession'

export default function Review() {
  const navigate = useNavigate()
  const home = useCallback(() => navigate('/'), [navigate])
  const [isEmpty, setEmpty] = useState(false)
  const empty = useCallback(() => setEmpty(true), [])
  const heading = import.meta.env.VITE_DEMO === 'true' ? <h1 data-tour="review">Review</h1> : null
  if (isEmpty) return <div className="card text-center">
    {heading}
    <p>Nothing is due. Come back later.</p>
    <Link to="/">Back to notebooks</Link>
  </div>
  return <div>
    {heading}
    <button className="btn-secondary mb-4" onClick={home}>Exit review</button>
    <PracticeSession deckId={null} onExit={home} onFinished={home} onEmpty={empty} />
  </div>
}
