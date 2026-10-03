import { Shape, Vector3 } from 'three'

export function faceShape(node) {
  const { w, h, kind } = node
  const shape = new Shape()
  if (kind === 'ellipse') {
    shape.absellipse(0, 0, w / 2, h / 2, 0, Math.PI * 2, false, 0)
  } else if (kind === 'diamond' || kind === 'tier') {
    const points = kind === 'diamond'
      ? [[0, h / 2], [w / 2, 0], [0, -h / 2], [-w / 2, 0]]
      : [[-node.topWidth / 2, h / 2], [node.topWidth / 2, h / 2], [w / 2, -h / 2], [-w / 2, -h / 2]]
    shape.moveTo(...points[0])
    points.slice(1).forEach(point => shape.lineTo(...point))
    shape.closePath()
  } else {
    const r = Math.min(10, w / 4, h / 4), x = -w / 2, y = -h / 2
    shape.moveTo(x + r, y)
    shape.lineTo(x + w - r, y)
    shape.quadraticCurveTo(x + w, y, x + w, y + r)
    shape.lineTo(x + w, y + h - r)
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    shape.lineTo(x + r, y + h)
    shape.quadraticCurveTo(x, y + h, x, y + h - r)
    shape.lineTo(x, y + r)
    shape.quadraticCurveTo(x, y, x + r, y)
  }
  return shape
}

export function boundsOf(doc) {
  if (!doc.nodes.length) return { center: new Vector3(), corners: [new Vector3(-100, -100, 0), new Vector3(100, 100, 30)], span: 200 }
  const corners = doc.nodes.flatMap(node => [0, node.w].flatMap(dx => [0, node.h].flatMap(dy =>
    [node.z, node.z + node.style.extrusion + 8].map(z => new Vector3(node.x + dx, -node.y - dy, z)))))
  const min = corners.reduce((v, p) => v.min(p), new Vector3(Infinity, Infinity, Infinity))
  const max = corners.reduce((v, p) => v.max(p), new Vector3(-Infinity, -Infinity, -Infinity))
  return { corners, center: min.clone().add(max).multiplyScalar(0.5), span: max.clone().sub(min).length() }
}

export { edgePoint } from './edgePoint'
