import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PracticeSession from '../components/PracticeSession'

export default function TestSession() {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const onExit = useCallback(() => navigate('/'), [navigate])
  const onFinished = useCallback(() => navigate('/progress'), [navigate])
  const onEmpty = useCallback(() => navigate('/upload'), [navigate])
  return <PracticeSession deckId={deckId ? Number(deckId) : null}
    onExit={onExit} onFinished={onFinished} onEmpty={onEmpty} />
}
