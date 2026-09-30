import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DeckEditor from '../components/DeckEditor'

export default function DeckDetails() {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const onBack = useCallback(() => navigate('/decks'), [navigate])
  return <DeckEditor deckId={deckId} onBack={onBack} onDeleted={onBack}
    onPractice={id => navigate(`/decks/${id}/practice`)}
    onOpenCanvas={id => navigate(`/canvas?document=${id}`)} />
}
