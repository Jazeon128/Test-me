import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { notebooksAPI } from '../services/api'

export default function DemoHome() {
  const [notebook, setNotebook] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    notebooksAPI.list().then(({ data }) => {
      if (alive) {
        if (data[0]) setNotebook(data[0])
        else setError('Demo notebook is missing.')
      }
    }).catch(() => { if (alive) setError('Could not load the demo notebook.') })
    return () => { alive = false }
  }, [])
  return notebook ? <Navigate to={`/notebooks/${notebook.id}`} replace />
    : <p role="status">{error || 'Loading demo notebook...'}</p>
}
