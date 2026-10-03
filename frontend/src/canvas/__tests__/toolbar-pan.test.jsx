import { act, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ExcalidrawSurface from '../ExcalidrawSurface'

const state = vi.hoisted(() => ({ props: null }))
vi.mock('@excalidraw/excalidraw', () => {
  const MainMenu = ({ children }) => <>{children}</>
  MainMenu.DefaultItems = { Export: () => null, Help: () => null }
  return { Excalidraw: props => {
    state.props = props
    return <div className="excalidraw"><div className="App-toolbar" /></div>
  }, MainMenu }
})
afterEach(() => vi.restoreAllMocks())

it.each([[0.5, 80], [1, 50], [2, 50]])('pans once at zoom %s and again after a Restore remount', async (zoom, expected) => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return this.classList.contains('App-toolbar') ? { bottom: 160 } : { top: 100 }
  })
  const props = { elements: [], onSave: vi.fn(), onSelectNode: vi.fn(), onSelectionChange: vi.fn() }
  const api = { getSceneElements: vi.fn(() => []), scrollToContent: vi.fn(), updateScene: vi.fn(),
    getAppState: vi.fn(() => ({ zoom: { value: zoom }, scrollY: 20 })) }
  const view = render(<ExcalidrawSurface key="open" {...props} />)
  act(() => state.props.excalidrawAPI(api))
  await waitFor(() => expect(api.updateScene.mock.calls.filter(([change]) => change.appState.scrollY !== undefined)).toHaveLength(1))
  const pans = () => api.updateScene.mock.calls.filter(([change]) => change.appState.scrollY !== undefined)
  expect(pans()[0][0]).toEqual({ appState: { scrollY: expected, ...(zoom > 1 ? { zoom: { value: 1 } } : {}) } })
  view.rerender(<ExcalidrawSurface key="open" {...props} />)
  expect(pans()).toHaveLength(1)
  view.rerender(<ExcalidrawSurface key="restore" {...props} />)
  act(() => state.props.excalidrawAPI(api))
  await waitFor(() => expect(pans()).toHaveLength(2))
  expect(pans()[1][0]).toEqual(pans()[0][0])
})
