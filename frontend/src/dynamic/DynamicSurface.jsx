/* eslint-disable react/no-unknown-property -- React Three Fiber uses three.js properties. */
import { useEffect, useMemo, useState } from 'react'
import { Object3D } from 'three'
import { Canvas } from '@react-three/fiber'
import DynamicCamera from './DynamicCamera'
import DynamicNode from './DynamicNode'
import DynamicEdge from './DynamicEdge'
import { placeEdgeLabels } from './labels'
import { boundsOf } from './geometry'
import './dynamic.css'

function useTheme() {
  const [theme, setTheme] = useState({ background: '#ffffff', accent: '#6741d9' })
  useEffect(() => {
    const read = () => {
      const css = getComputedStyle(document.documentElement)
      setTheme({ background: css.getPropertyValue('--surface-solid').trim() || '#ffffff',
        accent: css.getPropertyValue('--accent').trim() || '#6741d9' })
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return theme
}

function Scene({ doc, preset, selectedId, onSelectNode, accent, onHover }) {
  const nodes = useMemo(() => new Map(doc.nodes.map(node => [node.id, node])), [doc])
  const labels = useMemo(() => placeEdgeLabels(doc), [doc])
  const bounds = useMemo(() => boundsOf(doc), [doc])
  const lightTarget = useMemo(() => {
    const target = new Object3D()
    target.position.set(bounds.center.x, bounds.center.y, 0)
    return target
  }, [bounds])
  const span = Math.max(500, bounds.span)
  return <>
    <primitive object={lightTarget} />
    <ambientLight intensity={1.6} />
    <directionalLight position={[bounds.center.x - span / 2, bounds.center.y + span / 2, span * 1.5]}
      target={lightTarget} intensity={2} castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-span} shadow-camera-right={span}
      shadow-camera-top={span} shadow-camera-bottom={-span} shadow-camera-near={1}
      shadow-camera-far={span * 5} shadow-bias={-0.0001} shadow-radius={4} />
    <mesh receiveShadow position={[bounds.center.x, bounds.center.y, 0]}>
      <planeGeometry args={[span * 4, span * 4]} /><shadowMaterial transparent opacity={0.18} />
    </mesh>
    {doc.edges.map(edge => <DynamicEdge key={edge.id} edge={edge} nodes={nodes} labelPosition={labels.get(edge.id)} />)}
    {doc.nodes.map(node => <DynamicNode key={node.id} node={node} selected={selectedId === node.id}
      accent={accent} onSelect={onSelectNode} onHover={onHover} />)}
    <DynamicCamera doc={doc} preset={preset} />
  </>
}

function initialPreset() {
  try {
    const saved = localStorage.getItem('test-me.dynamicPreset')
    return ['Flat', 'Isometric', 'Tilted'].includes(saved) ? saved : 'Tilted'
  } catch { return 'Tilted' }
}

export default function DynamicSurface({ doc, onSelectNode = () => {}, selectedId: controlledId }) {
  const [preset, setPreset] = useState(initialPreset)
  const changePreset = name => {
    setPreset(name)
    try { localStorage.setItem('test-me.dynamicPreset', name) } catch { /* Storage may be disabled. */ }
  }
  const [selection, setSelection] = useState(null)
  const [hovered, setHovered] = useState(false)
  const theme = useTheme()
  const selectedId = controlledId === undefined ? selection : controlledId
  const select = (id, data) => { setSelection(id); onSelectNode(id, data) }
  return <div className="tm-dynamic" style={{ background: theme.background, cursor: hovered ? 'pointer' : 'grab' }}>
    <Canvas orthographic shadows camera={{ position: [0, -1000, 1000], near: 0.1, far: 100000, up: [0, 0, 1] }}
      onPointerMissed={event => { if (event.type === 'click') select(null) }}>
      <color attach="background" args={[theme.background]} />
      <Scene doc={doc} preset={preset} selectedId={selectedId} onSelectNode={select}
        accent={theme.accent} onHover={setHovered} />
    </Canvas>
    <div className="tm-dynamic-presets tm-segmented" role="group" aria-label="Camera preset">
      {['Flat', 'Isometric', 'Tilted'].map(name => <button type="button" key={name}
        aria-pressed={preset === name} onClick={() => changePreset(name)}>{name}</button>)}
    </div>
    <ul className="sr-only">
      {doc.nodes.filter(node => node.linked).map(node => <li key={node.id}>
        <button type="button" onClick={() => select(node.id, node)}>{node.label}</button>
      </li>)}
    </ul>
  </div>
}
