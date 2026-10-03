import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DynamicSurface from './DynamicSurface'
import { fromGraph } from './model'

function useFPS() {
  const [fps, setFPS] = useState(0)
  useEffect(() => {
    let request, frames = 0, start = performance.now()
    const tick = now => {
      frames++
      if (now - start >= 2000) {
        setFPS(Math.round(frames * 1000 / (now - start)))
        start = now
        frames = 0
      }
      request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [])
  return fps
}

export default function DynamicStress() {
  const [params] = useSearchParams()
  const parsed = Number(params.get('n') ?? 300)
  const n = Number.isFinite(parsed) ? Math.max(2, Math.floor(parsed)) : 300
  const doc = useMemo(() => {
    const columns = Math.ceil(Math.sqrt(n))
    const nodes = Array.from({ length: n }, (_, i) => ({
      id: `stress-${i}`, position: { x: (i % columns) * 230, y: Math.floor(i / columns) * 130 },
      width: 180, height: 80, data: { label: `Passage ${i + 1}`, source_section_id: i, color: 'blue' },
    }))
    const edges = nodes.map((node, i) => ({
      id: `edge-${i}`, source: node.id, target: nodes[i % columns === columns - 1 || i === n - 1 ? i - 1 : i + 1].id,
    }))
    return fromGraph('flowchart', { nodes, edges })
  }, [n])
  const fps = useFPS()
  return <div style={{ height: 'calc(100vh - 120px)', position: 'relative' }}>
    <DynamicSurface doc={doc} />
    <output style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text)' }}>{fps} FPS · {n} cards · {n} edges</output>
  </div>
}
