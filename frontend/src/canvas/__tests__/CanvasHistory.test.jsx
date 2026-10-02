import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import useCanvasEditing, { editedGraph, freePosition } from '../useCanvasEditing'

const initialNodes = [
  {
    id: 'a',
    type: 'StepNode',
    position: { x: 0, y: 0 },
    data: { label: 'A', color: 'slate', callback: () => {} },
  },
  { id: 'b', type: 'StepNode', position: { x: 400, y: 0 }, data: { label: 'B' } },
]
const initialEdges = [{ id: 'ab', source: 'a', target: 'b' }]
function setup() {
  const save = vi.fn()
  const view = renderHook(
    ({ canvasId }) => {
      const [nodes, setNodes] = useState(initialNodes)
      const [edges, setEdges] = useState(initialEdges)
      const [, setCanvas] = useState({ id: canvasId })
      return {
        ...useCanvasEditing({ nodes, edges, setNodes, setEdges, setCanvas, save, canvasId }),
        nodes,
        edges,
        setNodes,
      }
    },
    { initialProps: { canvasId: 7 } }
  )
  return { ...view, save }
}
it.each(['text', 'add', 'connect', 'delete', 'recolour', 'edge label', 'drag'])(
  'undoes and redoes %s with exactly one save per step and callback-free snapshots',
  operation => {
    const { result, save } = setup()
    const original = editedGraph(initialNodes, initialEdges)
    if (operation === 'drag') {
      act(() => result.current.beginDrag())
      act(() =>
        result.current.setNodes(initialNodes.map(node => ({ ...node, position: { x: 80, y: 90 } })))
      )
    }
    act(() => {
      const editor = result.current
      if (operation === 'text') editor.displayNodes[0].data.onSaveText({ label: 'Changed' })
      if (operation === 'add') editor.add({ x: 200, y: 200 })
      if (operation === 'connect') editor.connect({ source: 'b', target: 'a' })
      if (operation === 'delete') editor.remove(editor.nodes[0])
      if (operation === 'recolour') editor.recolour(editor.nodes[0], 'rose')
      if (operation === 'edge label') editor.labelEdge(editor.edges[0], 'Changed')
      if (operation === 'drag') editor.applyGraph(editor.nodes, editor.edges)
    })
    const changed = save.mock.calls[0][0].edited
    expect(changed).not.toEqual(original)
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
    act(() => result.current.undo())
    expect(save).toHaveBeenCalledTimes(2)
    expect(save.mock.calls[1][0].edited).toEqual(original)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
    act(() => result.current.redo())
    expect(save).toHaveBeenCalledTimes(3)
    expect(save.mock.calls[2][0].edited).toEqual(changed)
    expect(result.current.canRedo).toBe(false)
  }
)
it('clears redo for a new change and limits past to 50 steps', () => {
  const { result, save } = setup()
  for (let i = 1; i <= 51; i++) {
    act(() => result.current.labelEdge(result.current.edges[0], String(i)))
  }
  for (let i = 0; i < 50; i++) act(() => result.current.undo())
  expect(result.current.canUndo).toBe(false)
  expect(result.current.edges[0].label).toBe('1')
  const count = save.mock.calls.length
  act(() => result.current.undo())
  expect(save).toHaveBeenCalledTimes(count)
  act(() => result.current.labelEdge(result.current.edges[0], 'New'))
  expect(result.current.canRedo).toBe(false)
})
it('clears history on load, restore reset and canvas id changes', () => {
  const { result, rerender, save } = setup()
  expect(result.current.canUndo).toBe(false)
  act(() => result.current.add({ x: 200, y: 200 }))
  act(() => result.current.undo())
  act(() => result.current.clearHistory())
  expect(result.current.canUndo).toBe(false)
  expect(result.current.canRedo).toBe(false)
  act(() => result.current.add({ x: 200, y: 200 }))
  rerender({ canvasId: 8 })
  expect(result.current.canUndo).toBe(false)
  expect(result.current.canRedo).toBe(false)
  expect(save).toHaveBeenCalledTimes(3)
})
it('avoids the occupied centre, respects measured dimensions and falls back after 40 tries', () => {
  const centre = { x: 0, y: 0 }
  const position = freePosition(centre, [initialNodes[0]])
  expect(position).not.toEqual(centre)
  expect(
    position.y >= 60 || position.y + 60 <= 0 || position.x >= 180 || position.x + 180 <= 0
  ).toBe(true)
  expect(freePosition(centre, [{ ...initialNodes[0], measured: { width: 1, height: 1 } }])).toEqual(
    { x: 40, y: 0 }
  )
  expect(
    freePosition(centre, [
      {
        ...initialNodes[0],
        position: { x: -1000, y: -1000 },
        measured: { width: 2000, height: 2000 },
      },
    ])
  ).toEqual(centre)
})
