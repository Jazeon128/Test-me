import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import CanvasView from '../CanvasView'

export default function CanvasRouteHarness() {
  const { canvasId } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const query = params.get('sources') || params.get('document') || ''
  const sourceIds = useMemo(() => [...new Set(query.split(',').filter(Boolean).map(Number))], [query])
  return <CanvasView canvasId={canvasId} sourceIds={sourceIds} notebookId={params.get('notebook') || undefined}
    onCreated={id => navigate(`/canvas/${id}`, { replace: true })}
    onClose={id => navigate(id ? `/notebooks/${id}` : '/')} />
}
