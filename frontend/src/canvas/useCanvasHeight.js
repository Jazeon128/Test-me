import { useLayoutEffect, useRef } from 'react'

export default function useCanvasHeight(embedded) {
  const canvasRef = useRef(null)
  const bodyRef = useRef(null)
  useLayoutEffect(() => {
    if (!embedded) return
    const measure = () => {
      const top = bodyRef.current.getBoundingClientRect().top + window.scrollY
      canvasRef.current.style.setProperty('--canvas-top', `${top}px`)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(canvasRef.current.querySelector('header'))
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [embedded])
  return { canvasRef, bodyRef }
}
