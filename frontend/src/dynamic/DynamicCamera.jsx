import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei/core/OrbitControls'
import { MOUSE, Vector3 } from 'three'
import { boundsOf } from './geometry'

const RAD = Math.PI / 180
const ANGLES = { Flat: [0, 90], Angled: [20, 50], Tilted: [0, 55] }

function destination(preset, bounds) {
  const [azimuth, elevation] = ANGLES[preset].map(angle => angle * RAD)
  const distance = Math.max(1000, bounds.span * 3)
  return bounds.center.clone().add(new Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    -Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation),
  ).multiplyScalar(distance))
}

function fitZoom(camera, bounds, position) {
  const probe = camera.clone()
  probe.position.copy(position)
  probe.zoom = 1
  probe.lookAt(bounds.center)
  probe.updateMatrixWorld()
  probe.updateProjectionMatrix()
  const projected = bounds.corners.map(point => point.clone().project(probe))
  const extentX = Math.max(...projected.map(p => Math.abs(p.x)))
  const extentY = Math.max(...projected.map(p => Math.abs(p.y)))
  return Math.min(1 / Math.max(0.001, extentX), 1 / Math.max(0.001, extentY)) / 1.1
}

export default function DynamicCamera({ doc, preset }) {
  const { camera, size } = useThree()
  const controls = useRef()
  const animation = useRef(null)
  const initialized = useRef(false)
  const [alt, setAlt] = useState(false)
  const bounds = useMemo(() => boundsOf(doc), [doc])
  useEffect(() => {
    const key = event => setAlt(event.altKey)
    const blur = () => setAlt(false)
    window.addEventListener('keydown', key)
    window.addEventListener('keyup', key)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', key)
      window.removeEventListener('keyup', key)
      window.removeEventListener('blur', blur)
    }
  }, [])
  useEffect(() => {
    const end = destination(preset, bounds)
    const zoom = fitZoom(camera, bounds, end)
    const instant = !initialized.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    animation.current = {
      start: performance.now(), duration: instant ? 0 : 450,
      from: camera.position.clone(), to: end, zoomFrom: camera.zoom, zoomTo: zoom,
      targetFrom: controls.current?.target.clone() || bounds.center.clone(), targetTo: bounds.center,
    }
    initialized.current = true
  }, [camera, size, bounds, preset])
  useFrame(() => {
    const motion = animation.current
    if (!motion || !controls.current) return
    const t = motion.duration ? Math.min(1, (performance.now() - motion.start) / motion.duration) : 1
    const eased = t * t * (3 - 2 * t)
    camera.position.lerpVectors(motion.from, motion.to, eased)
    controls.current.target.lerpVectors(motion.targetFrom, motion.targetTo, eased)
    camera.lookAt(controls.current.target)
    camera.zoom = motion.zoomFrom + (motion.zoomTo - motion.zoomFrom) * eased
    camera.updateProjectionMatrix()
    controls.current.update()
    if (t === 1) animation.current = null
  })
  return <OrbitControls ref={controls} makeDefault enableRotate={alt} enableDamping={false}
    minPolarAngle={0} maxPolarAngle={70 * RAD} screenSpacePanning
    mouseButtons={{ LEFT: alt ? MOUSE.ROTATE : MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
    onStart={() => { animation.current = null }} />
}
