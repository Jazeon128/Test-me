import { expect, it, vi } from 'vitest'
import { exportToCanvas } from '@excalidraw/excalidraw'
import { registerSketchFonts } from '../scene'

vi.mock('@excalidraw/excalidraw', () => ({ convertToExcalidrawElements: vi.fn(), exportToCanvas: vi.fn().mockResolvedValue({}) }))

it('invokes Excalidraw font loading through its public export API without measuring scene text', async () => {
  await registerSketchFonts()
  expect(exportToCanvas).toHaveBeenCalledOnce()
  const options = exportToCanvas.mock.calls[0][0]
  expect(options.elements).toEqual([])
  expect(options.files).toBeNull()
  expect(options.getDimensions()).toEqual({ width: 1, height: 1 })
})
