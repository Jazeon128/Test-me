import { act, render, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import ExcalidrawSurface from '../ExcalidrawSurface'
const state = vi.hoisted(() => ({ props: null }))
vi.mock('@excalidraw/excalidraw', () => {
  const MainMenu = ({ children }) => <>{children}</>
  MainMenu.DefaultItems = { Export: () => null, Help: () => null }
  return { Excalidraw: props => { state.props = props; return <div className="excalidraw" /> }, MainMenu }
})
it('leaves initial centring disabled and fits once after the scene is ready', async () => {
  const elements = [{ id: 'band', type: 'rectangle', version: 1, x: 0, y: 0 }]
  const props = { elements, onSave: vi.fn(), onSelectNode: vi.fn(), onSelectionChange: vi.fn() }
  const api = { getSceneElements: vi.fn(() => elements), scrollToContent: vi.fn(), updateScene: vi.fn(), getAppState: vi.fn(() => ({ zoom: { value: 1 }, scrollY: 0 })) }
  const view = render(<ExcalidrawSurface {...props} />)
  expect(state.props.initialData).not.toHaveProperty('scrollToContent')
  act(() => state.props.excalidrawAPI(api))
  expect(api.scrollToContent).not.toHaveBeenCalled()
  act(() => state.props.onChange([], { selectedElementIds: {} }))
  expect(api.scrollToContent).not.toHaveBeenCalled()
  act(() => state.props.onChange(elements, { selectedElementIds: {} }))
  await waitFor(() => expect(api.scrollToContent).toHaveBeenCalledTimes(1))
  expect(api.scrollToContent).toHaveBeenCalledWith(elements, { fitToContent: true, viewportZoomFactor: 0.8, animate: false })
  view.rerender(<ExcalidrawSurface {...props} />)
  act(() => state.props.onChange(elements, { selectedElementIds: {} }))
  expect(api.scrollToContent).toHaveBeenCalledTimes(1)
})
