import { edgePoint } from './edgePoint'

export const EDGE_LABEL_HEIGHT = 26
export function edgeLabelWidth(label) {
  return Math.min(240, Math.max(60, label.length * 7 + 20))
}

function rectangle(point, width, padding = 0) {
  return { x: point.x - width / 2 - padding, y: point.y - EDGE_LABEL_HEIGHT / 2 - padding,
    w: width + padding * 2, h: EDGE_LABEL_HEIGHT + padding * 2 }
}

function overlapArea(a, b) {
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return w * h
}

const ELEVATION = 55 * Math.PI / 180
const top = node => (node.z ?? 0) + (node.style?.extrusion ?? 0)

export function projectRectangle(rect, z = 0) {
  const corners = [rect.x, rect.x + rect.w].flatMap(x => [rect.y, rect.y + rect.h]
    .map(y => ({ x, y: y * Math.sin(ELEVATION) - z * Math.cos(ELEVATION) })))
  const x = Math.min(...corners.map(point => point.x)), y = Math.min(...corners.map(point => point.y))
  return { x, y, w: Math.max(...corners.map(point => point.x)) - x,
    h: Math.max(...corners.map(point => point.y)) - y }
}

export function edgeLabelZ(source, target, point) {
  const a = edgePoint(source, target), b = edgePoint(target, source)
  const dx = b[0] - a[0], dy = -(b[1] - a[1])
  const t = Math.max(0, Math.min(1,
    ((point.x - a[0]) * dx + (point.y + a[1]) * dy) / (dx * dx + dy * dy || 1)))
  return top(source) + 1 + (top(target) - top(source)) * t
}

function candidates(source, target, times, offsets, offsetFirst = false) {
  const a = edgePoint(source, target), b = edgePoint(target, source)
  const dx = b[0] - a[0], dy = -(b[1] - a[1])
  const length = Math.hypot(dx, dy) || 1
  const point = (t, offset) => ({
    x: a[0] + dx * t - dy / length * offset,
    y: -a[1] + dy * t + dx / length * offset,
  })
  return offsetFirst ? offsets.flatMap(offset => times.map(t => point(t, offset)))
    : times.flatMap(t => offsets.map(offset => point(t, offset)))
}

export function placeEdgeLabels(doc) {
  const result = new Map()
  const nodes = new Map(doc.nodes.map(node => [node.id, node]))
  const obstacles = doc.nodes.map(({ x, y, w, h }) => ({ x, y, w, h }))
  const projected = doc.nodes.map(node => projectRectangle(node, top(node)))
  const edges = doc.edges.filter(edge => edge.label).slice().sort((a, b) =>
    String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0)
  const incoming = new Map()
  for (const edge of edges) incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1)
  for (const edge of edges) {
    const source = nodes.get(edge.from), target = nodes.get(edge.to)
    if (!source || !target) continue
    const width = edgeLabelWidth(edge.label)
    let best, least = Infinity
    const times = incoming.get(edge.to) >= 3 ? [0.25, 0.2, 0.35, 0.15, 0.5] : [0.5, 0.35, 0.65, 0.2, 0.8]
    const initial = candidates(source, target, times, [0, 28, -28])
    const extended = candidates(source, target, Array.from({ length: 19 }, (_, i) => (i + 1) / 20),
      [0, 28, -28, 56, -56, 84, -84, 112, -112, 140, -140, 168, -168, 196, -196, 224, -224], true)
    for (const point of [...initial, ...extended]) {
      const padded = rectangle(point, width, 6)
      const tilted = projectRectangle(padded, edgeLabelZ(source, target, point))
      const area = obstacles.reduce((total, obstacle) => total + overlapArea(padded, obstacle), 0)
        + projected.reduce((total, obstacle) => total + overlapArea(tilted, obstacle), 0)
      if (area < least) { best = point; least = area }
      if (area === 0) break
    }
    result.set(edge.id, best)
    obstacles.push(rectangle(best, width))
    projected.push(projectRectangle(rectangle(best, width), edgeLabelZ(source, target, best)))
  }
  return result
}
