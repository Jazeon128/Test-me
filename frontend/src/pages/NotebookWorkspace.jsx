import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { notebooksAPI, statusAPI } from '../services/api'
import PracticeSession from '../components/PracticeSession'
import DeckEditor from '../components/DeckEditor'
import SourcesPanel from '../components/workspace/SourcesPanel'
import StudioPanel from '../components/workspace/StudioPanel'
import ChatPanel from '../components/workspace/ChatPanel'
import WorkspacePanel from '../components/workspace/WorkspacePanel'
import WorkspaceDrawer from '../components/workspace/WorkspaceDrawer'
import useMediaQuery from '../hooks/useMediaQuery'
import { FileText, Sparkles, X } from 'lucide-react'

const storageKey = 'testme.workspace.collapsed'
const jobId = job => job.job_id || job.id
const running = job => !['completed', 'finished', 'failed', 'cancelled'].includes(job.status)

export default function NotebookWorkspace() {
  const { notebookId } = useParams()
  return <Workspace key={notebookId} notebookId={notebookId} />
}

function Workspace({ notebookId }) {
  const navigate = useNavigate()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const [drawer, setDrawer] = useState(null)
  const deckHeader = useRef(null)
  const opener = useRef(null)
  const centre = useRef(null)

  const [params, setParams] = useSearchParams()
  const deckId = Number(params.get('deck'))
  const view = params.get('view')
  const hasOpenDeck = Number.isInteger(deckId) && deckId > 0 && ['practice', 'edit'].includes(view)
  const [workspace, setWorkspace] = useState(null)
  const loaded = Boolean(workspace)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (hasOpenDeck) deckHeader.current?.focus()
    else if (wasOpen.current) {
      if (opener.current?.isConnected && !opener.current.closest('[hidden]')) opener.current.focus()
      else centre.current?.querySelector('textarea')?.focus()
    }
    wasOpen.current = hasOpenDeck
  }, [hasOpenDeck, deckId, view, loaded])
  useEffect(() => { if (desktop) setDrawer(null) }, [desktop])
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
  const open = useCallback((id, view, trigger) => {
    if (trigger) opener.current = trigger
    setDrawer(null)
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
  const deckName = workspace.artifacts.decks.find(deck => deck.id === deckId)?.name || 'deck'
  const panels = {
    sources: <SourcesPanel notebookId={notebookId} sources={workspace.sources}
      selected={selected} setSelected={setSelected} refresh={refresh} />,
    studio: <StudioPanel notebookId={notebookId} sourceIds={sourceIds} jobs={jobs}
      artifacts={workspace.artifacts} progress={workspace.progress} refresh={refresh} open={open} onCanvas={onCanvas}
      onJob={job => { localJobs.current.set(jobId(job), job); setJobs(current => [...current, job]) }} />,
  }
  const counts = { sources: workspace.sources.filter(source => source.status === 'ready').length,
    studio: workspace.artifacts.decks.length + workspace.artifacts.canvases.length }
  const panel = side => <WorkspacePanel side={side} count={counts[side]} collapsed={desktop && collapsed[side]}
    toggle={desktop ? () => toggle(side) : null}>{panels[side]}</WorkspacePanel>
  return <div className="notebook-workspace" style={{ '--sources-width': collapsed.sources ? '44px' : '280px', '--studio-width': collapsed.studio ? '44px' : '320px' }}>
    {!desktop && <div className="workspace-topbar" inert={drawer ? '' : undefined}>
      <button className="btn-secondary" onClick={() => setDrawer('sources')}><FileText size={18} aria-hidden="true" />Sources <span>{sourceIds.length}</span></button>
      <button className="btn-secondary" onClick={() => setDrawer('studio')}><Sparkles size={18} aria-hidden="true" />Studio <span>{jobs.filter(running).length}</span></button>
    </div>}
    {desktop && panel('sources')}
    <section ref={centre} className="workspace-centre" aria-label={hasOpenDeck ? `${view === 'practice' ? 'Practising' : 'Editing'} ${deckName}` : 'Chat'} inert={drawer ? '' : undefined}>
      {error && <p role="alert" className="workspace-error">{error}</p>}
      <div className="workspace-chat" hidden={hasOpenDeck}>
        <p className="eyebrow">Notebook</p>
        <h1>{workspace.notebook.name}</h1>
        <p className="page-intro mt-3">{workspace.notebook.description}</p>
        <ChatPanel notebookId={notebookId} sourceIds={sourceIds} sources={workspace.sources} />
      </div>
      {hasOpenDeck && <>
        <header ref={deckHeader} tabIndex={-1} className="workspace-deck-header">
          <h1>{view === 'practice' ? 'Practising' : 'Editing'} {deckName}</h1>
          <button onClick={close} className="icon-button" aria-label="Close"><X size={20} aria-hidden="true" /></button>
        </header>
        {view === 'practice' ? <PracticeSession embedded key={`practice-${deckId}`} deckId={deckId}
          onExit={close} onFinished={close} onEmpty={close} />
          : <DeckEditor embedded key={`edit-${deckId}`} deckId={deckId} onBack={close} onDeleted={close}
            onPractice={id => open(id, 'practice')} onOpenCanvas={onCanvas} />}
      </>}
    </section>
    {desktop && panel('studio')}
    {!desktop && drawer && <WorkspaceDrawer side={drawer} onClose={() => setDrawer(null)}>{panel(drawer)}</WorkspaceDrawer>}
  </div>
}
