// Returns renderer coordinates. This geometry stays independent of three.js.
export function edgePoint(node, other, z = 0) {
  const x = node.x + node.w / 2, y = -node.y - node.h / 2
  const dx = other.x + other.w / 2 - x, dy = -other.y - other.h / 2 - y
  if (!dx && !dy) return [x, y, z]
  let scale
  if (node.kind === 'ellipse') scale = 1 / Math.hypot(dx / (node.w / 2), dy / (node.h / 2))
  else if (node.kind === 'diamond') scale = 1 / (Math.abs(dx) / (node.w / 2) + Math.abs(dy) / (node.h / 2))
  else if (node.kind === 'tier') {
    const points = [[-node.topWidth / 2, node.h / 2], [node.topWidth / 2, node.h / 2],
      [node.w / 2, -node.h / 2], [-node.w / 2, -node.h / 2], [-node.topWidth / 2, node.h / 2]]
    const hits = points.slice(0, -1).flatMap((p, i) => {
      const q = points[i + 1], ex = q[0] - p[0], ey = q[1] - p[1]
      const cross = dx * ey - dy * ex
      if (Math.abs(cross) < 0.0001) return []
      const t = (p[0] * ey - p[1] * ex) / cross
      const u = (p[0] * dy - p[1] * dx) / cross
      return t >= 0 && u >= 0 && u <= 1 ? [t] : []
    })
    scale = Math.min(...hits)
  } else scale = 1 / Math.max(Math.abs(dx) / (node.w / 2), Math.abs(dy) / (node.h / 2))
  return [x + dx * scale, y + dy * scale, z]
}
