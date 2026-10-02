import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Loader2, Sparkles, AlertCircle, ArrowLeft, FileText } from 'lucide-react'
import { canvasAPI, documentsAPI, notebooksAPI, statusAPI } from '../services/api'
import { nodeTypes } from '../canvas/nodeTypes'
import { layout, toGraph, withMatrixHeaders } from '../canvas/layout'
import TemplatePicker from '../canvas/TemplatePicker'
import NodePanel from '../canvas/NodePanel'
import useCanvasSave from '../canvas/useCanvasSave'
import useCanvasEditing from '../canvas/useCanvasEditing'
import CanvasToolbar from '../canvas/CanvasToolbar'
import CanvasSaveControls from '../canvas/CanvasSaveControls'
import canvasShortcuts from '../canvas/canvasShortcuts'
import { Generating, EmptyState, TemplateBadge } from '../canvas/CanvasChrome'
import '../canvas/canvas.css'

const POLL_MS = 900

const LAYOUTS = {
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

export default function Canvas() {
  const { canvasId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sourceQuery = searchParams.get('sources') || searchParams.get('document') || ''
  const sourceIds = useMemo(() => [...new Set(sourceQuery.split(',').filter(Boolean).map(Number))], [sourceQuery])
  const sourceNotebookId = searchParams.get('notebook')
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
  const [selectedEdge, setSelectedEdge] = useState(null)
  const flowRef = useRef(null)
  const wrapperRef = useRef(null)
  const [source, setSource] = useState(null)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const { status: saveStatus, save, flush, retry } = useCanvasSave(canvas?.id)
  const {
    displayNodes, editing, startEditing, applyGraph, add, connect, canDelete, remove,
    recolour, labelEdge, undo, redo, canUndo, canRedo, clearHistory, beginDrag,
  } = useCanvasEditing({ nodes, edges, setNodes, setEdges, setCanvas, save, canvasId })
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

  const openSource = useCallback(
    async (targetCanvasId, node) => {
      setSelected(node)
      setSelectedEdge(null)
      setSource(null)
      if (node.data.added || node.type === 'MatrixHeader') return
      try {
        const response = await canvasAPI.nodeSource(targetCanvasId, node.id)
        setSource(response.data)
      } catch {
        setSource({ section: null })
      }
    },
    []
  )

  const draw = useCallback(
    async (record) => {
      const edited = record.edited && record.template === 'comparison_matrix'
        ? withMatrixHeaders(record.edited, record.payload) : record.edited
      const laidOut = edited || await layout(record.template, toGraph(record.template, record.payload), {
        algorithm: LAYOUTS[record.template] || 'layered',
        orientation: record.payload?.orientation || 'horizontal',
      })
      const saved = record.edited ? {} : record.layout || {}
      setNodes(
        laidOut.nodes.map((node) => ({
          ...node,
          position: saved[node.id] || node.position,
          data: {
            ...node.data,
            onOpenSource: () => openSource(record.id, node),
          },
        }))
      )
      clearHistory()
      setEdges(laidOut.edges)
      setCanvas(record)
      drawnIdRef.current = String(record.id)
      setPhase('ready')
    },
    [openSource, setEdges, setNodes, clearHistory]
  )

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
          navigate(`/canvas/${response.data.id}`, { replace: true })
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
    [draw, navigate]
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

  const persistLayout = useCallback((_, dragged, draggedNodes) => {
    if (!canvas) return
    const moved = new Map((draggedNodes || [dragged]).filter(Boolean).map(node => [node.id, node.position]))
    const next = nodes.map(node => moved.has(node.id) ? { ...node, position: moved.get(node.id) } : node)
    applyGraph(next, edges, true, !(canvas.has_edits || canvas.edited))
  }, [canvas, nodes, edges, applyGraph])

  const addNode = note => {
    const rect = wrapperRef.current.getBoundingClientRect()
    const position = flowRef.current.screenToFlowPosition({
      x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
    })
    setSelected(add(position, note))
    setSelectedEdge(null)
    setSource(null)
  }
  const deleteSelected = () => {
    if (remove(selected, selectedEdge)) {
      setSelected(null)
      setSelectedEdge(null)
      setSource(null)
    }
  }

  const restore = async () => {
    save({ edited: null, layout: null })
    if (await flush()) {
      startEditing(null)
      setSelected(null)
      setSelectedEdge(null)
      setSource(null)
      await draw({ ...canvas, edited: null, has_edits: false, layout: null })
      setRestoring(false)
    }
  }

  const documentName = useMemo(() => canvas?.title || request, [canvas, request])
  const notebookId = canvas ? canvas.notebook_id : sourceNotebookId || documentContext[0]?.notebook_id
  const notebookName = canvas ? canvas.notebook_name : notebookContext?.name || (
    String(documentContext[0]?.notebook_id) === String(notebookId) ? documentContext[0]?.notebook_name : null
  )
  const backLabel = notebookId && notebookName ? `Back to ${notebookName}` : 'Back to notebooks'
  const sources = canvas ? canvas.sources || [{ id: canvas.document_id, name: canvas.source_name || canvas.document_name }] :
    documentContext.map(doc => ({ id: doc.id, name: doc.display_name }))

  return (
    <div className="tm-canvas flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--line)' }}
    >
      <header
        className="flex flex-col gap-3 border-b px-4 py-3"
        style={{ borderColor: 'var(--line)', background: 'var(--chrome)' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(notebookId && notebookName ? `/notebooks/${notebookId}` : '/')}
            className="btn-secondary flex items-center gap-1.5 text-xs"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            {backLabel}
          </button>
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1
              className="min-w-0 flex-1 truncate text-sm font-semibold"
              style={{ color: 'var(--text)' }}
              title={canvas.request_text}
            >
              {canvas.request_text}
            </h1>
            <CanvasSaveControls status={saveStatus} retry={retry} restore={restore}
              restoring={restoring} setRestoring={setRestoring}
              hasChanges={Boolean(canvas.has_edits || canvas.edited || canvas.layout)} />
            <TemplateBadge canvas={canvas} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
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
              background: 'var(--bg)',
              borderColor: 'var(--line2)',
              color: 'var(--text)',
              minHeight: 44,
            }}
          />
          <button
            type="button"
            onClick={() => start()}
            disabled={!request.trim() || phase === 'generating'}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)', minHeight: 44 }}
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
      <div className="flex min-h-0 flex-1">
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
            <div
              className="tm-flow-editor"
              inert={restoring ? '' : undefined}
              tabIndex={0}
              onKeyDown={event => canvasShortcuts(event, {
                undo, redo, add: addNode, remove: deleteSelected, edit: startEditing, selected, editing,
                clear: () => { setSelected(null); setSelectedEdge(null); setSource(null) },
              })}
            >
              <CanvasToolbar undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo}
                selected={nodes.find(node => node.id === selected?.id)}
                edge={edges.find(edge => edge.id === selectedEdge?.id)} onEdit={startEditing}
                onAdd={addNode} onDelete={deleteSelected} canDelete={canDelete(selected)}
                onColour={color => recolour(selected, color)}
                onLabel={label => labelEdge(selectedEdge, label)} />
              <div className="tm-drawing-surface" ref={wrapperRef}>
                <ReactFlow
                  onInit={instance => { flowRef.current = instance }}
                  onConnect={connect}
                  nodes={displayNodes.map(node => ({ ...node, data: {
                    ...node.data, onOpenSource: () => openSource(canvas.id, node),
                  } }))}
                  deleteKeyCode={null}
                  onNodeDoubleClick={(_, node) => startEditing(node.id)}
                  edges={edges.map(edge => ({ ...edge, selectable: true }))}
                  onEdgeClick={(_, edge) => {
                    setSelectedEdge(edge)
                    setSelected(null)
                    setSource(null)
                  }}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeDragStart={beginDrag}
                  onNodeDragStop={persistLayout}
                  onNodeClick={(_, node) => openSource(canvas.id, node)}
                  onPaneClick={() => {
                    setSelected(null)
                    setSelectedEdge(null)
                    setSource(null)
                  }}
                  fitView
                  proOptions={{ hideAttribution: false }}
                >
                  <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--dot)" />
                  <Controls showInteractive={false} />
                </ReactFlow>
              </div>
            </div>
          )}
        </div>
        {phase === 'ready' && selected && !selected.data.added && selected.type !== 'MatrixHeader' && (
          <NodePanel
            key={`${canvas.id}:${selected.id}`}
            canvasId={canvas.id}
            node={nodes.find(node => node.id === selected.id) || selected}
            source={source}
            onClose={() => {
              setSelected(null)
              setSource(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
