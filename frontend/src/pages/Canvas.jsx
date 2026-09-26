import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Loader2, Sparkles, AlertCircle } from 'lucide-react'
import PropTypes from 'prop-types'

import { canvasAPI, statusAPI } from '../services/api'
import { nodeTypes } from '../canvas/nodes'
import { layout, toGraph } from '../canvas/layout'
import TemplatePicker from '../canvas/TemplatePicker'
import NodePanel from '../canvas/NodePanel'
import '../canvas/canvas.css'

const POLL_MS = 900

/** elk algorithm per template. Mirrors backend/app/services/viz/templates.py. */
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
}

export default function Canvas() {
  const { canvasId } = useParams()
  const [searchParams] = useSearchParams()
  const documentId = searchParams.get('document')

  const [request, setRequest] = useState('')
  const [phase, setPhase] = useState(canvasId ? 'loading' : 'idle')
  const [step, setStep] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [canvas, setCanvas] = useState(null)
  const [picker, setPicker] = useState(null)
  const [selected, setSelected] = useState(null)
  const [source, setSource] = useState(null)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const pollRef = useRef(null)
  const jobRef = useRef(null)

  // Stop polling when the component goes away, so a long generation does not
  // keep firing requests after the user navigates off.
  useEffect(() => () => clearTimeout(pollRef.current), [])

  const openSource = useCallback(
    async (targetCanvasId, node) => {
      setSelected(node)
      setSource(null)
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
      const graph = toGraph(record.template, record.payload)
      const laidOut = await layout(record.template, graph, {
        algorithm: LAYOUTS[record.template] || 'layered',
        orientation: record.payload?.orientation || 'horizontal',
      })

      const saved = record.layout || {}
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
      setEdges(laidOut.edges)
      setCanvas(record)
      setPhase('ready')
    },
    [openSource, setEdges, setNodes]
  )

  // Load an existing canvas by id.
  useEffect(() => {
    if (!canvasId) return
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
          const response = await canvasAPI.get(data.deck_id)
          await draw(response.data)
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
    [draw]
  )

  const start = useCallback(
    async (template = null) => {
      if (!documentId) {
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
        const { data } = await canvasAPI.generate(Number(documentId), request, template)
        jobRef.current = data.job_id
        poll(data.job_id)
      } catch (err) {
        setError(err.response?.data?.detail || 'Could not start the canvas.')
        setPhase('error')
      }
    },
    [documentId, poll, request]
  )

  const persistLayout = useCallback(async () => {
    if (!canvas) return
    const positions = Object.fromEntries(nodes.map((node) => [node.id, node.position]))
    try {
      await canvasAPI.update(canvas.id, { layout: positions })
    } catch {
      // A failed position save is not worth interrupting the person over; the
      // canvas still works, it just opens laid out automatically next time.
    }
  }, [canvas, nodes])

  const documentName = useMemo(() => canvas?.title || request, [canvas, request])

  return (
    <div className="tm-canvas flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--line)' }}
    >
      <header
        className="flex flex-wrap items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: 'var(--line)', background: 'var(--chrome)' }}
      >
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
          placeholder="Ask about this document: how does a request flow through it, why does it fail…"
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
        {canvas && (
          <span className="tm-mono text-xs" style={{ color: 'var(--text3)' }}>
            {canvas.template}
            {canvas.routing_confidence != null
              ? ` · ${Math.round(canvas.routing_confidence * 100)}%`
              : canvas.chosen_by_user
                ? ' · your choice'
                : ''}
          </span>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {phase === 'idle' && <EmptyState name={documentName} />}

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
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={persistLayout}
              onNodeClick={(_, node) => openSource(canvas.id, node)}
              onPaneClick={() => {
                setSelected(null)
                setSource(null)
              }}
              fitView
              proOptions={{ hideAttribution: false }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--dot)" />
              <Controls showInteractive={false} />
            </ReactFlow>
          )}
        </div>

        {phase === 'ready' && selected && (
          <NodePanel
            canvasId={canvas.id}
            node={selected}
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

function Generating({ step, progress }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <Loader2 size={22} className="animate-spin" style={{ color: 'var(--accent)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
        {step || 'Working'}
      </p>
      <div
        className="h-1 w-64 overflow-hidden rounded-full"
        style={{ background: 'var(--s3)' }}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progress}%`, background: 'var(--accent)' }}
        />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Ask something about this document
        </p>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
          The canvas picks how to draw the answer: a flowchart, an architecture
          diagram, a fishbone, a timeline. You do not choose the form, and every
          node traces back to the passage it came from.
        </p>
      </div>
    </div>
  )
}

Generating.propTypes = {
  step: PropTypes.string,
  progress: PropTypes.number,
}
