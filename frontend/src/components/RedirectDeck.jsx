import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { decksAPI } from '../services/api'
import Spinner from './Spinner'
import { serverMessage } from '../utils/serverMessage'

export default function RedirectDeck({ view }) {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setError('')
    decksAPI.get(deckId).then(({ data }) => {
      if (active) navigate(`/notebooks/${data.notebook_id}?deck=${data.id}&view=${view}`, { replace: true })
    }).catch(err => {
      if (!active) return
      const status = err.status || err.response?.status || err.originalError?.response?.status
      setError(status === 404 ? 'That deck no longer exists' : serverMessage(err.originalError || err) || 'Could not load that deck.')
    })
    return () => { active = false }
  }, [deckId, navigate, view])
  if (error) return <div className="card"><p role="alert">{error}</p><Link to="/">Back to notebooks</Link></div>
  return <div className="flex h-64 items-center justify-center"><Spinner aria-label="Loading deck" className="h-8 w-8" /></div>
}
