import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import CanvasView from '../CanvasView'
import { canvasAPI } from '../../services/api'
import { layout } from '../layout'
import { graphToScene, registerSketchFonts } from '../scene'

vi.mock('../../services/api', () => ({
  canvasAPI: { get: vi.fn() }, documentsAPI: {}, notebooksAPI: {}, statusAPI: {},
}))
vi.mock('../layout', async importOriginal => ({ ...await importOriginal(), layout: vi.fn(async (_, graph) => graph) }))
vi.mock('../scene', () => ({
  graphToScene: vi.fn(() => []), registerSketchFonts: vi.fn(),
}))
vi.mock('../ExcalidrawSurface', () => ({ default: () => <div data-testid="font-board" /> }))

const fontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts')
afterEach(() => {
  vi.clearAllMocks()
  if (fontsDescriptor) Object.defineProperty(document, 'fonts', fontsDescriptor)
  else delete document.fonts
})

function openBoard(fonts, edited) {
  Object.defineProperty(document, 'fonts', { configurable: true, value: fonts })
  canvasAPI.get.mockResolvedValue({ data: { id: 6, template: 'flowchart', payload: { nodes: [], edges: [] }, edited } })
  render(<CanvasView canvasId="6" />)
}

it('registers Excalifont and waits for both font promises before layout and graphToScene', async () => {
  let resolve16, resolve20
  const pending16 = new Promise(resolve => { resolve16 = resolve })
  const pending20 = new Promise(resolve => { resolve20 = resolve })
  const fonts = { [Symbol.iterator]: function* () {}, load: vi.fn(size => size.startsWith('16px') ? pending16 : pending20) }
  registerSketchFonts.mockImplementation(async () => {
    expect(fonts.load).not.toHaveBeenCalled()
  })
  openBoard(fonts)
  await waitFor(() => expect(fonts.load).toHaveBeenCalledTimes(2))
  expect(registerSketchFonts).toHaveBeenCalledOnce()
  expect(fonts.load.mock.calls).toEqual([['16px Excalifont'], ['20px Excalifont']])
  expect(layout).not.toHaveBeenCalled()
  expect(graphToScene).not.toHaveBeenCalled()
  await act(async () => resolve16([]))
  expect(graphToScene).not.toHaveBeenCalled()
  await act(async () => resolve20([]))
  await screen.findByTestId('font-board')
  expect(layout).toHaveBeenCalledOnce()
  expect(graphToScene).toHaveBeenCalledOnce()
})

it('uses an already registered Excalifont without registering it again', async () => {
  const fonts = { [Symbol.iterator]: function* () { yield { family: 'Excalifont' } }, load: vi.fn().mockResolvedValue([]) }
  openBoard(fonts)
  await screen.findByTestId('font-board')
  expect(registerSketchFonts).not.toHaveBeenCalled()
  expect(fonts.load).toHaveBeenCalledTimes(2)
})

it('falls back to scene creation when a font load fails', async () => {
  openBoard({ load: vi.fn().mockRejectedValue(new Error('Font unavailable')) })
  await screen.findByTestId('font-board')
  expect(graphToScene).toHaveBeenCalledOnce()
})

it('opens saved Excalidraw elements without loading fonts or rebuilding the scene', async () => {
  const fonts = { load: vi.fn() }
  openBoard(fonts, { schema_version: 2, elements: [] })
  await screen.findByTestId('font-board')
  expect(fonts.load).not.toHaveBeenCalled()
  expect(graphToScene).not.toHaveBeenCalled()
})
