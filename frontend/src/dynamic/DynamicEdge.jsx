/* eslint-disable react/no-unknown-property -- React Three Fiber uses three.js properties. */
import { useMemo } from 'react'
import { Billboard } from '@react-three/drei/core/Billboard'
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
  const z = Math.max(source.z + source.style.extrusion, target.z + target.style.extrusion) + 2
  const a = edgePoint(source, target, z), b = edgePoint(target, source, z)
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0])
  return <group>
    <Line points={[a, b]} color={edge.style.stroke.color} lineWidth={edge.style.stroke.width} />
    <mesh position={b} rotation={[0, 0, angle]}>
      <shapeGeometry args={[arrow]} /><meshBasicMaterial color={edge.style.stroke.color} />
    </mesh>
    {edge.label && labelPosition && <Billboard position={[labelPosition.x, -labelPosition.y, z + 0.5]}>
      <mesh renderOrder={2}><shapeGeometry args={[plate]} />
        <meshBasicMaterial color={edge.style.fill.colors[0]} depthTest={false} depthWrite={false} />
      </mesh>
      <FaceLabel position={[0, 0, 0.5]} fontSize={14} maxWidth={width - 12} color={edge.style.text.color}>{edge.label}</FaceLabel>
    </Billboard>}
  </group>
}
