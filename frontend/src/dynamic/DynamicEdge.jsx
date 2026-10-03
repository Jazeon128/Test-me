/* eslint-disable react/no-unknown-property -- React Three Fiber uses three.js properties. */
import { useMemo } from 'react'
import { Line } from '@react-three/drei/core/Line'
import { Shape } from 'three'
import { edgePoint, faceShape } from './geometry'
import { edgeLabelWidth, EDGE_LABEL_HEIGHT } from './labels'
import { FaceLabel } from './DynamicNode'

export default function DynamicEdge({ edge, nodes, labelPosition }) {
  const source = nodes.get(edge.from), target = nodes.get(edge.to)
  const arrow = useMemo(() => {
    const shape = new Shape()
    shape.moveTo(0, 0); shape.lineTo(-14, 6); shape.lineTo(-14, -6); shape.closePath()
    return shape
  }, [])
  const width = edgeLabelWidth(edge.label)
  const plate = useMemo(() => faceShape({ kind: 'card', w: width, h: EDGE_LABEL_HEIGHT }), [width])
  if (!source || !target) return null
  const a = edgePoint(source, target, source.z + source.style.extrusion + 1)
  const b = edgePoint(target, source, target.z + target.style.extrusion + 1)
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const t = labelPosition ? Math.max(0, Math.min(1,
    ((labelPosition.x - a[0]) * dx + (-labelPosition.y - a[1]) * dy) / (dx * dx + dy * dy || 1))) : 0.5
  const labelZ = a[2] + (b[2] - a[2]) * t
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0])
  return <group>
    <Line points={[a, b]} color={edge.style.stroke.color} lineWidth={edge.style.stroke.width} />
    <mesh position={b} rotation={[0, 0, angle]}>
      <shapeGeometry args={[arrow]} /><meshBasicMaterial color={edge.style.stroke.color} />
    </mesh>
    {edge.label && labelPosition && <group position={[labelPosition.x, -labelPosition.y, labelZ]}>
      <mesh><shapeGeometry args={[plate]} />
        <meshBasicMaterial color={edge.style.fill.colors[0]} />
      </mesh>
      <FaceLabel position={[0, 0, 0.5]} fontSize={14} maxWidth={width - 12} color={edge.style.text.color}>{edge.label}</FaceLabel>
    </group>}
  </group>
}
