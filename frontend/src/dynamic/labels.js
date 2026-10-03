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

function candidates(source, target) {
  const a = edgePoint(source, target), b = edgePoint(target, source)
  const dx = b[0] - a[0], dy = -(b[1] - a[1])
  const length = Math.hypot(dx, dy) || 1
  return [0.5, 0.35, 0.65, 0.2, 0.8].flatMap(t => [0, 28, -28].map(offset => ({
    x: a[0] + dx * t - dy / length * offset,
    y: -a[1] + dy * t + dx / length * offset,
  })))
}

export function placeEdgeLabels(doc) {
  const result = new Map()
  const nodes = new Map(doc.nodes.map(node => [node.id, node]))
  const obstacles = doc.nodes.map(({ x, y, w, h }) => ({ x, y, w, h }))
  const edges = doc.edges.filter(edge => edge.label).slice().sort((a, b) =>
    String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0)
  for (const edge of edges) {
    const source = nodes.get(edge.from), target = nodes.get(edge.to)
    if (!source || !target) continue
    const width = edgeLabelWidth(edge.label)
    let best, least = Infinity
    for (const point of candidates(source, target)) {
      const padded = rectangle(point, width, 6)
      const area = obstacles.reduce((total, obstacle) => total + overlapArea(padded, obstacle), 0)
      if (area < least) { best = point; least = area }
      if (area === 0) break
    }
    result.set(edge.id, best)
    obstacles.push(rectangle(best, width))
  }
  return result
}
