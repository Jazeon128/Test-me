import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { canvasAPI, documentsAPI } from '../services/api'
import CanvasView from '../canvas/CanvasView'

export default function Canvas() {
  const { canvasId } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const sourceQuery = params.get('sources') || params.get('document') || ''
  const sourceIds = useMemo(() => [...new Set(sourceQuery.split(',').filter(Boolean).map(Number))], [sourceQuery])
  const notebookId = params.get('notebook')
  const [context, setContext] = useState(null)
  useEffect(() => {
    let alive = true
    setContext(null)
    const resolve = async () => {
      try {
        if (canvasId) {
          const { data } = await canvasAPI.get(canvasId)
          return data.notebook_id || null
        }
        if (notebookId) return notebookId
        const records = await Promise.all(sourceIds.map(id => documentsAPI.get(String(id)).then(({ data }) => data)))
        const ids = new Set(records.map(record => record.notebook_id))
        return ids.size === 1 && records[0]?.notebook_id || null
      } catch { return null }
    }
    resolve().then(id => { if (alive) setContext({ notebookId: id }) })
    return () => { alive = false }
  }, [canvasId, notebookId, sourceIds])
  if (!context) return <p role="status">Loading canvas...</p>
  if (context.notebookId) {
    const query = new URLSearchParams({ view: 'canvas' })
    if (canvasId) query.set('canvas', canvasId)
    else if (sourceQuery) query.set('sources', sourceQuery)
    return <Navigate replace to={`/notebooks/${context.notebookId}?${query}`} />
  }
  return <CanvasView canvasId={canvasId} sourceIds={sourceIds} notebookId={null}
    onCreated={id => navigate(`/canvas/${id}`, { replace: true })}
    onClose={() => navigate('/')} />
}
