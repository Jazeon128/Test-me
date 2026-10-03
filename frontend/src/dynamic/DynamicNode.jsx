/* eslint-disable react/no-unknown-property -- React Three Fiber uses three.js properties. */
import { useEffect, useMemo, useState } from 'react'
import { Line } from '@react-three/drei/core/Line'
import { Text } from '@react-three/drei/core/Text'
import { Color, ExtrudeGeometry } from 'three'
import { configureTextBuilder } from 'troika-three-text'
import font from '@fontsource/inter/files/inter-latin-500-normal.woff?url'
import { faceShape } from './geometry'
import { innerBox } from './fit'

const localFont = import.meta.env.DEV
  ? new URL(font, window.location.href).href
  : new URL(font.split('/').at(-1), import.meta.url).href
configureTextBuilder({ defaultFontURL: localFont,
  unicodeFontsURL: new URL('unicode/', localFont).href })

export function FaceLabel({ children, ...props }) {
  return <Text material-depthTest={false} material-depthWrite={false} renderOrder={3}
    font={localFont} anchorX="center" anchorY="middle" textAlign="center" {...props}>{children}</Text>
}

export default function DynamicNode({ node, selected, accent, onSelect, onHover }) {
  const [hovered, setHovered] = useState(false)
  const shape = useMemo(() => faceShape(node), [node])
  const geometry = useMemo(() => new ExtrudeGeometry(shape, {
    depth: node.style.extrusion, bevelEnabled: true, bevelSize: 1,
    bevelThickness: 0.5, bevelSegments: 2, curveSegments: 16, steps: 1,
  }), [shape, node.style.extrusion])
  useEffect(() => () => geometry.dispose(), [geometry])
  const outline = useMemo(() => shape.getPoints(48).map(p => [p.x, p.y, node.style.extrusion + 0.8]), [shape, node.style.extrusion])
  const fill = node.style.fill.colors[0]
  const side = useMemo(() => new Color(fill).multiplyScalar(0.82), [fill])
  return <group position={[node.x + node.w / 2, -node.y - node.h / 2, node.z + (hovered ? 6 : 0)]}
    onPointerOver={event => { event.stopPropagation(); setHovered(true); onHover(true) }}
    onPointerOut={() => { setHovered(false); onHover(false) }}
    onClick={event => { event.stopPropagation(); if (node.linked) onSelect(node.id, node) }}>
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial attach="material-0" color={fill} transparent opacity={node.style.opacity} roughness={0.9} />
      <meshStandardMaterial attach="material-1" color={side} transparent opacity={node.style.opacity} roughness={0.9} />
    </mesh>
    <Line points={outline} color={selected ? accent : node.style.stroke.color} lineWidth={selected ? 3 : node.style.stroke.width} />
    <FaceLabel position={[0, 0, node.style.extrusion + 0.5]} maxWidth={innerBox(node).w}
      whiteSpace="nowrap" lineHeight={1.3} fontSize={node.textSize} color={node.style.text.color}>
      {node.lines.join('\n')}
    </FaceLabel>
  </group>
}
