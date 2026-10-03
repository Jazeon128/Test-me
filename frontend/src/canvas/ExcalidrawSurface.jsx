import './excalidrawAssets'
import { useEffect, useRef, useState } from 'react'
import { Excalidraw, MainMenu } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { sceneNodeId, sceneForSave } from './scene'

export default function ExcalidrawSurface({ elements, onSelectNode, onSave, onSelectionChange }) {
  const [theme, setTheme] = useState(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  const version = useRef(elements.reduce((sum, element) => sum + element.version, 0))
  const selection = useRef('')
  // Excalidraw inverts the scene in dark mode, including its background.
  const background = '#f3f4f6'
  const [api, setApi] = useState(null)
  const [sceneReady, setSceneReady] = useState(elements.length === 0)
  const fitted = useRef(false)
  const initialData = useRef({ elements, appState: { theme, viewBackgroundColor: background }, scrollToContent: true })
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light'))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  useEffect(() => { api?.updateScene({ appState: { theme, viewBackgroundColor: background } }) }, [api, theme, background])
  useEffect(() => {
    if (!api || !sceneReady || fitted.current) return
    fitted.current = true
    api.scrollToContent(api.getSceneElements(), { fitToContent: true, animate: false })
    // scrollToContent commits its zoom through React state before the next frame.
    requestAnimationFrame(() => {
      const zoom = api.getAppState().zoom
      if (zoom.value > 1) api.updateScene({ appState: { zoom: { ...zoom, value: 1 } } })
    })
  }, [api, sceneReady])
  const onChange = (next, appState) => {
    if (!sceneReady) {
      const ids = new Set(next.map(element => element.id))
      if (initialData.current.elements.every(element => ids.has(element.id))) setSceneReady(true)
    }
    const sum = next.reduce((total, element) => total + element.version, 0)
    if (sum !== version.current) {
      version.current = sum
      onSave({ edited: { schema_version: 2, elements: sceneForSave(next) } })
    }
    const ids = Object.keys(appState.selectedElementIds || {}).filter(id => appState.selectedElementIds[id]).sort()
    const key = JSON.stringify(ids)
    if (selection.current !== key) {
      selection.current = key
      onSelectionChange(ids.length > 0)
      const element = ids.length === 1 ? next.find(item => item.id === ids[0] && !item.isDeleted) : null
      const nodeId = sceneNodeId(element, next)
      const shape = next.find(item => item.customData?.nodeId === nodeId && item.type !== 'text' && !item.isDeleted)
      onSelectNode(nodeId, shape?.customData)
    }
  }
  return <Excalidraw initialData={initialData.current} theme={theme} excalidrawAPI={setApi}
    onChange={onChange} UIOptions={{ tools: { image: false } }}>
    <MainMenu>
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.Help />
    </MainMenu>
  </Excalidraw>
}
