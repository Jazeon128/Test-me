import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { notebooksAPI, statusAPI } from '../services/api'
import PracticeSession from '../components/PracticeSession'
import DeckEditor from '../components/DeckEditor'
import SourcesPanel from '../components/workspace/SourcesPanel'
import StudioPanel from '../components/workspace/StudioPanel'
import ChatPanel from '../components/workspace/ChatPanel'

const storageKey = 'testme.workspace.collapsed'
const jobId = job => job.job_id || job.id
const running = job => !['completed', 'finished', 'failed', 'cancelled'].includes(job.status)

export default function NotebookWorkspace() {
  const { notebookId } = useParams()
  return <Workspace key={notebookId} notebookId={notebookId} />
}

function Workspace({ notebookId }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [workspace, setWorkspace] = useState(null)
  const [selected, setSelected] = useState({})
  const seenReady = useRef(new Set())
  const localJobs = useRef(new Map())
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')
  const alive = useRef(true)
  const inFlight = useRef(null)
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || {} }
    catch { return {} }
  })
  const refresh = useCallback(() => {
    if (inFlight.current) return inFlight.current
    inFlight.current = (async () => {
      try {
        const statuses = new Map()
        for (const [id, previous] of localJobs.current) {
          if (!running(previous)) { statuses.set(id, previous); continue }
          try {
            const { data: status } = await statusAPI.get(id)
            statuses.set(id, { ...status, job_id: id })
          } catch { statuses.set(id, previous) }
          if (!alive.current) return
        }
        // Refresh after status checks so completed artifacts are included in this snapshot.
        const { data } = await notebooksAPI.workspace(notebookId)
        if (!alive.current) return
        const merged = new Map(data.jobs.map(job => [jobId(job), job]))
        for (const [id, status] of statuses) {
          if (running(status) || status.status === 'failed') merged.set(id, status)
          else { merged.delete(id); localJobs.current.delete(id) }
        }
        // Retain failures after they leave the workspace's running list.
        for (const [id, job] of merged) localJobs.current.set(id, job)
        setJobs([...merged.values()])
        setWorkspace(data)
        setError('')
        const newlyReady = data.sources.filter(source => source.status === 'ready' && !seenReady.current.has(source.id))
        data.sources.forEach(source => {
          if (source.status === 'ready') seenReady.current.add(source.id)
          else seenReady.current.delete(source.id)
        })
        setSelected(current => {
          const next = { ...current }
          newlyReady.forEach(source => { next[source.id] = true })
          data.sources.forEach(source => { if (source.status !== 'ready') next[source.id] = false })
          return next
        })
      } catch (err) {
        if (alive.current) setError(err.message || 'That notebook could not be loaded.')
      } finally { inFlight.current = null }
    })()
    return inFlight.current
  }, [notebookId])
  useEffect(() => {
    alive.current = true
    refresh()
    return () => { alive.current = false }
  }, [refresh])
  const shouldPoll = workspace?.sources.some(source => source.status === 'processing') || jobs.some(running)
  useEffect(() => {
    if (!shouldPoll) return
    const timer = setInterval(refresh, 2000)
    return () => clearInterval(timer)
  }, [shouldPoll, refresh])
  const close = useCallback(() => {
    setParams(current => {
      const next = new URLSearchParams(current)
      next.delete('deck'); next.delete('view')
      return next
    })
    refresh()
  }, [setParams, refresh])
  const open = useCallback((id, view) => {
    setParams(current => {
      const next = new URLSearchParams(current)
      next.set('deck', String(id)); next.set('view', view)
      return next
    })
  }, [setParams])
  const onCanvas = id => navigate(`/canvas?document=${id}`)
  const toggle = side => {
    const next = { ...collapsed, [side]: !collapsed[side] }
    setCollapsed(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* Storage can be unavailable. */ }
  }
  if (!workspace) return <div className="notebook-workspace">{error ? <p role="alert">{error}</p> : <p>Loading notebook...</p>}</div>
  const sourceIds = workspace.sources.filter(source => source.status === 'ready' && selected[source.id]).map(source => source.id)
  const deckId = Number(params.get('deck'))
  const view = params.get('view')
  const hasOpenDeck = Number.isInteger(deckId) && deckId > 0 && ['practice', 'edit'].includes(view)
  return <div className="notebook-workspace" style={{ '--sources-width': collapsed.sources ? '44px' : '280px', '--studio-width': collapsed.studio ? '44px' : '320px' }}>
    <aside className={`workspace-panel ${collapsed.sources ? 'workspace-rail' : ''}`} aria-label="Sources panel">
      <button aria-label={collapsed.sources ? 'Expand sources' : 'Collapse sources'} aria-expanded={!collapsed.sources}
        onClick={() => toggle('sources')}>{collapsed.sources ? '>' : '<'}</button>
      {!collapsed.sources && <SourcesPanel notebookId={notebookId} sources={workspace.sources}
        selected={selected} setSelected={setSelected} refresh={refresh} />}
    </aside>
    <section className="workspace-centre" aria-label="Current work">
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <div className="workspace-chat" hidden={hasOpenDeck}>
        <h1 className="text-3xl font-bold">{workspace.notebook.name}</h1>
        <p className="mt-3">{workspace.notebook.description}</p>
        <ChatPanel notebookId={notebookId} sourceIds={sourceIds} sources={workspace.sources} />
      </div>
      {hasOpenDeck && <>
        <button onClick={close} className="mb-4">Close</button>
        {view === 'practice' ? <PracticeSession key={`practice-${deckId}`} deckId={deckId}
          onExit={close} onFinished={close} onEmpty={close} />
          : <DeckEditor key={`edit-${deckId}`} deckId={deckId} onBack={close} onDeleted={close}
            onPractice={id => open(id, 'practice')} onOpenCanvas={onCanvas} />}
      </>}
    </section>
    <aside className={`workspace-panel ${collapsed.studio ? 'workspace-rail' : ''}`} aria-label="Studio panel">
      <button aria-label={collapsed.studio ? 'Expand studio' : 'Collapse studio'} aria-expanded={!collapsed.studio}
        onClick={() => toggle('studio')}>{collapsed.studio ? '<' : '>'}</button>
      {!collapsed.studio && <StudioPanel notebookId={notebookId} sourceIds={sourceIds} jobs={jobs}
        artifacts={workspace.artifacts} progress={workspace.progress} refresh={refresh} open={open} onCanvas={onCanvas}
        onJob={job => { localJobs.current.set(jobId(job), job); setJobs(current => [...current, job]) }} />}
    </aside>
  </div>
}
