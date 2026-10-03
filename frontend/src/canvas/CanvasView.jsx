import { lazy, Suspense, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Loader2, Sparkles, AlertCircle, ArrowLeft, FileText } from 'lucide-react'
import { canvasAPI, documentsAPI, notebooksAPI, statusAPI } from '../services/api'
import { layout, toGraph, withMatrixHeaders } from './layout'
import TemplatePicker from './TemplatePicker'
import NodePanel from './NodePanel'
import useCanvasPersistence from './useCanvasPersistence'
import useCanvasHeight from './useCanvasHeight'
import CanvasSaveControls from './CanvasSaveControls'
import { Generating, EmptyState, TemplateBadge } from './CanvasChrome'
import { canvasTitle } from './canvasTitle'
import './canvas.css'

const ExcalidrawSurface = lazy(() => import('./ExcalidrawSurface'))

const POLL_MS = 900

const LAYOUTS = {
  pyramid: 'box',
  flowchart: 'layered',
  architecture: 'layered',
  fishbone: 'fishbone',
  mindmap: 'mrtree',
  swimlane: 'layered',
  timeline: 'layered',
  comparison_matrix: 'box',
  hierarchy: 'mrtree',
  state_machine: 'layered',
  c4_context: 'layered',
  concept_map: 'force',
  causal_loop: 'force',
  decision_tree: 'layered',
  sequence: 'sequence',
}

const CanvasView = forwardRef(function CanvasView({ canvasId, sourceIds = [], notebookId: sourceNotebookId, onCreated, onClose, embedded = false, onTitle }, ref) {
  const { canvasRef, bodyRef } = useCanvasHeight(embedded)
  const [documentContext, setDocumentContext] = useState([])
  const [notebookContext, setNotebookContext] = useState(null)

  const [request, setRequest] = useState('')
  const [phase, setPhase] = useState(canvasId ? 'loading' : 'idle')
  const [step, setStep] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [canvas, setCanvas] = useState(null)
  const selectedSourceIds = useMemo(() => canvasId ? canvas?.source_ids || (canvas ? [canvas.document_id] : []) : sourceIds, [canvasId, canvas, sourceIds])
  const [picker, setPicker] = useState(null)
  const [selected, setSelected] = useState(null)
  const [source, setSource] = useState(null)
  const [elements, setElements] = useState([])
  const [sceneKey, setSceneKey] = useState(0)
  const [hasSelection, setHasSelection] = useState(false)
  const sourceRequest = useRef(0)
  const { status: saveStatus, save, flush, retry } = useCanvasPersistence(canvas?.id)
  useImperativeHandle(ref, () => ({ flush }), [flush])
  const [restoring, setRestoring] = useState(false)

  const pollRef = useRef(null)
  const jobRef = useRef(null)

  const drawnIdRef = useRef(null)

  useEffect(() => {
    if (canvasId || !sourceIds.length) return
    let cancelled = false
    setDocumentContext([])
    Promise.all(sourceIds.map(id => documentsAPI.get(String(id)).then(({ data }) => data).catch(() => null))).then(data => {
      if (!cancelled) setDocumentContext(data.filter(Boolean))
    })

    return () => { cancelled = true }
  }, [canvasId, sourceIds])

  useEffect(() => {
    if (canvasId || !sourceNotebookId) return
    let cancelled = false
    setNotebookContext(null)
    notebooksAPI.get(sourceNotebookId).then(({ data }) => {
      if (!cancelled) setNotebookContext(data)
    }).catch(() => {})

    return () => { cancelled = true }
  }, [canvasId, sourceNotebookId])

  useEffect(() => () => clearTimeout(pollRef.current), [])

  const openSource = useCallback(async (targetCanvasId, node) => {
    const requestId = ++sourceRequest.current
    setSelected(node)
    setSource(null)
    if (!node) return
    try {
      const response = await canvasAPI.nodeSource(targetCanvasId, node.id)
      if (requestId === sourceRequest.current) setSource(response.data)
    } catch {
      if (requestId === sourceRequest.current) setSource({ section: null })
    }
  }, [])

  const draw = useCallback(async (record) => {
    let scene
    if (record.edited?.schema_version === 2) {
      scene = record.edited.elements
    } else {
      const { graphToScene } = await import('./scene')
      const edited = record.edited && record.template === 'comparison_matrix'
        ? withMatrixHeaders(record.edited, record.payload) : record.edited
      const graph = edited || await layout(record.template, toGraph(record.template, record.payload), {
        algorithm: LAYOUTS[record.template] || 'layered',
        orientation: record.payload?.orientation || 'horizontal',
      })
      const saved = record.edited ? {} : record.layout || {}
      scene = graphToScene(record.template, {
        ...graph, nodes: graph.nodes.map(node => ({ ...node, position: saved[node.id] || node.position })),
      })
    }
    sourceRequest.current++
    setSelected(null)
    setSource(null)
    setHasSelection(false)
    setElements(scene)
    setSceneKey(key => key + 1)
    setCanvas(record)
    onTitle?.(record.title || record.request_text)
    drawnIdRef.current = String(record.id)
    setPhase('ready')
  }, [onTitle])

  useEffect(() => {
    if (!canvasId || drawnIdRef.current === canvasId) return
    let cancelled = false
    canvasAPI
      .get(canvasId)
      .then((response) => {
        if (!cancelled) draw(response.data)
      })
      .catch(() => {
        if (!cancelled) {
          setError('That canvas could not be loaded.')
          setPhase('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [canvasId, draw])

  const poll = useCallback(
    async (jobId) => {
      try {
        const { data } = await statusAPI.get(jobId)
        setStep(data.current_step || '')
        setProgress(data.progress || 0)
        if (data.status === 'completed') {
          const response = await canvasAPI.get(data.result_id ?? data.deck_id)
          await draw(response.data)
          onCreated(response.data.id)
          return
        }
        if (data.status === 'needs_choice') {
          const candidates = await canvasAPI.candidates(jobId)
          setPicker(candidates.data)
          setPhase('choosing')
          return
        }
        if (data.status === 'failed') {
          setError(data.error_message || 'Generation failed.')
          setPhase('error')
          return
        }
        pollRef.current = setTimeout(() => poll(jobId), POLL_MS)
      } catch {
        setError('Lost contact with the server while drawing.')
        setPhase('error')
      }
    },
    [draw, onCreated]
  )

  const start = useCallback(
    async (template = null) => {
      if (!selectedSourceIds.length) {
        setError('Open a canvas from a document.')
        setPhase('error')
        return
      }
      setError(null)
      setPicker(null)
      setPhase('generating')
      setProgress(0)
      setStep('Starting')
      try {
        const { data } = await canvasAPI.generate({ sourceIds: selectedSourceIds, requestText: request, template })
        jobRef.current = data.job_id
        poll(data.job_id)
      } catch (err) {
        setError(err.response?.data?.detail || err.message || 'Could not start the canvas.')
        setPhase('error')
      }
    },
    [selectedSourceIds, poll, request]
  )

  const restore = async () => {
    save({ edited: null, layout: null })
    if (await flush()) {
      setSelected(null)
      setSource(null)
      await draw({ ...canvas, edited: null, has_edits: false, layout: null })
      setRestoring(false)
    }
  }

  const documentName = useMemo(() => canvas?.title || request, [canvas, request])
  const notebookId = canvas ? canvas.notebook_id : sourceNotebookId === null ? null : sourceNotebookId || (documentContext.length && documentContext.every(doc => doc.notebook_id === documentContext[0].notebook_id) ? documentContext[0].notebook_id : null)
  const notebookName = canvas ? canvas.notebook_name : notebookContext?.name || (
    String(documentContext[0]?.notebook_id) === String(notebookId) ? documentContext[0]?.notebook_name : null
  )
  const backLabel = notebookId && notebookName ? `Back to ${notebookName}` : 'Back to notebooks'
  const sources = canvas ? canvas.sources || [{ id: canvas.document_id, name: canvas.source_name || canvas.document_name }] :
    documentContext.map(doc => ({ id: doc.id, name: doc.display_name }))

  return (
    <div ref={canvasRef} className={`tm-canvas ${embedded ? 'tm-canvas-embedded' : 'h-[calc(100vh-8rem)]'} flex flex-col rounded-xl border`}
      style={{ borderColor: 'var(--line)' }}
    >
      <header
        className="tm-canvas-header flex flex-col gap-3 border-b px-4 py-3"
        style={{ borderColor: 'var(--line)', background: 'var(--chrome)' }}
      >
        <div className="tm-canvas-meta flex flex-wrap items-center gap-3">
          <div className="tm-canvas-sources flex flex-wrap items-center gap-3">
          {!embedded && <button
            type="button"
            onClick={async () => { if (await flush()) onClose(notebookId && notebookName ? notebookId : null) }}
            className="btn-secondary flex items-center gap-1.5 text-xs"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            {backLabel}
          </button>}
          {sources.filter(source => source.name).map(source => (
            <span
              key={source.id}
              className="flex min-w-0 max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs sm:max-w-xs"
              style={{ borderColor: 'var(--line)', color: 'var(--text2)' }}
            >
              <FileText size={14} className="shrink-0" aria-hidden="true" />
              <span className="sr-only">Drawn from</span>
              <span className="truncate" title={source.name}>{source.name}</span>
            </span>
          ))}
          </div>
        {canvas && (
          <div className="tm-canvas-controls flex flex-wrap items-center gap-x-3 gap-y-2">
            {!embedded && <h1
              className="min-w-0 flex-1 truncate text-sm font-semibold"
              style={{ color: 'var(--text)' }}
              title={canvas.request_text}
            >
              {canvasTitle(canvas.title || canvas.request_text)}
            </h1>}
            <CanvasSaveControls status={saveStatus} retry={retry} restore={restore}
              restoring={restoring} setRestoring={setRestoring}
              hasChanges={Boolean(canvas.has_edits || canvas.edited || canvas.layout)} />
            <TemplateBadge canvas={canvas} />
          </div>
        )}
        </div>
        <div className="tm-canvas-question flex items-center gap-3">
          <label htmlFor="canvas-request" className="sr-only">
            What do you want to see?
          </label>
          <input
            id="canvas-request"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && request.trim()) start()
            }}
            placeholder={
              canvas
                ? 'Ask something else about this source…'
                : 'Ask about this document: how does a request flow through it, why does it fail…'
            }
            className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
            style={{
              background: embedded ? 'var(--field)' : 'var(--bg)',
              borderColor: embedded ? 'var(--line)' : 'var(--line2)',
              color: 'var(--text)',
              minHeight: 44,
            }}
          />
          <button
            type="button"
            onClick={() => start()}
            disabled={!request.trim() || phase === 'generating'}
            className={embedded ? 'btn-primary flex items-center gap-2' : 'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50'}
            style={embedded ? undefined : { background: 'var(--accent)', color: 'var(--accent-ink)', minHeight: 44 }}
          >
            {phase === 'generating' ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Sparkles size={15} />
            )}
            Draw it
          </button>
        </div>
      </header>
      <div ref={bodyRef} className="tm-canvas-body flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {phase === 'idle' && <EmptyState name={documentName} onExample={example => {
            setRequest(example)
            document.getElementById('canvas-request')?.focus()
          }} />}
          {phase === 'generating' && <Generating step={step} progress={progress} />}
          {phase === 'error' && (
            <div className="flex h-full items-center justify-center p-6">
              <div className="flex max-w-md items-start gap-3">
                <AlertCircle size={18} style={{ color: 'var(--rose-i)', flex: 'none', marginTop: 2 }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    That did not work
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text2)' }}>
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}
          {phase === 'choosing' && picker && (
            <TemplatePicker
              reason={picker.reason}
              candidates={picker.candidates}
              onPick={(template) => start(template)}
            />
          )}
          {phase === 'ready' && (
            <div className="tm-whiteboard flex h-full flex-col" inert={restoring ? '' : undefined}>
              {!hasSelection && <p className="px-4 py-1 text-xs" style={{ color: 'var(--text2)' }}>
                Click a shape drawn from your source to see its passage and questions.
              </p>}
              <div className="tm-drawing-surface min-h-0 flex-1">
                <Suspense fallback={<Loader2 aria-label="Loading whiteboard" className="m-auto animate-spin" size={20} />}>
                  <ExcalidrawSurface key={sceneKey} elements={elements} onSelectionChange={setHasSelection}
                    onSelectNode={(nodeId, data) => openSource(canvas.id, nodeId ? {
                      id: nodeId, data: { label: data.label, detail: data.detail, source_section_id: data.sourceSectionId },
                    } : null)}
                    onSave={payload => {
                      save(payload)
                      setCanvas(current => ({ ...current, edited: payload.edited, has_edits: true }))
                    }} />
                </Suspense>
              </div>
            </div>
          )}
        </div>
        {phase === 'ready' && source && selected && (
          <NodePanel
            key={`${canvas.id}:${selected.id}`}
            canvasId={canvas.id}
            node={selected}
            source={source}
            onClose={() => {
              openSource(canvas.id, null)
            }}
          />
        )}
      </div>
    </div>
  )
})

export default CanvasView
