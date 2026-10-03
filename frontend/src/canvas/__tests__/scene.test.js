import { expect, it, vi } from 'vitest'
import { graphSkeletons, graphToScene, sceneNodeId, SCENE_COLOURS } from '../scene'
import { resolveAssetPath } from '../excalidrawAssets'

// The real package cannot import in jsdom: open-color.json lacks an import attribute.
vi.mock('@excalidraw/excalidraw', () => ({ convertToExcalidrawElements: skeletons => skeletons }))

const node = (id, type = 'StepNode', data = {}) => ({
  id, type, position: { x: 10, y: 20 }, data: { label: id, ...data },
})

it('converts one shape per node with provenance, dimensions, default text colour and bound arrows', () => {
  const graph = { nodes: [node('a', 'ActorNode'), {
    ...node('b', 'StepNode', { kind: 'decision', color: 'blue' }), position: { x: 300, y: 150 },
  }],
    edges: [{ id: 'ab', source: 'a', target: 'b', label: 'Next' }] }
  const scene = graphToScene('flowchart', graph)
  const shapes = scene.filter(element => element.customData?.nodeId)
  expect(shapes).toHaveLength(2)
  expect(shapes[0]).toMatchObject({ id: 'a', type: 'ellipse', x: 10, y: 20, width: 180, height: 62,
    customData: { nodeId: 'a', label: 'a' }, roughness: 1 })
  expect(shapes[1]).toMatchObject({ type: 'diamond', strokeColor: '#1971c2', backgroundColor: '#a5d8ff' })
  const arrow = scene.find(element => element.type === 'arrow')
  expect(arrow.start).toEqual({ id: 'a' })
  expect(arrow.end).toEqual({ id: 'b' })
  expect([arrow.x, arrow.y, arrow.width, arrow.height].every(Number.isFinite)).toBe(true)
  expect(shapes.every(shape => shape.label.strokeColor === '#1e1e1e')).toBe(true)
  expect(arrow.label).toEqual({ text: 'Next', strokeColor: '#1e1e1e' })
})

it('starts and ends arrows outside their shapes so they do not cross the labels', () => {
  const graph = { nodes: [node('a'), { ...node('b'), position: { x: 300, y: 20 } }],
    edges: [{ id: 'ab', source: 'a', target: 'b' }] }
  const arrow = graphSkeletons('flowchart', graph).find(element => element.type === 'arrow')
  expect(arrow).toMatchObject({ x: 198, y: 51, width: 94, height: 0, points: [[0, 0], [94, 0]] })
})

it('maps shapes and colours, draws groups first and preserves layout size', () => {
  const nodes = [node('step'), node('milestone', 'MilestoneNode'), node('question', 'StepNode', { kind: 'question' }),
    { ...node('group', 'GroupNode'), style: { width: 600, height: 300 } },
    node('header', 'MatrixHeader'), ...Object.keys(SCENE_COLOURS).map(color => node(color, 'StepNode', { color })),
    node('unknown', 'StepNode', { color: 'unknown' })]
  const skeletons = graphSkeletons('decision_tree', { nodes, edges: [] })
  expect(skeletons[0]).toMatchObject({ id: 'group', type: 'rectangle', width: 600, height: 300,
    label: { verticalAlign: 'top' } })
  expect(skeletons.find(element => element.id === 'step').type).toBe('rectangle')
  expect(skeletons.find(element => element.id === 'milestone').type).toBe('ellipse')
  expect(skeletons.find(element => element.id === 'question').type).toBe('diamond')
  expect(skeletons.find(element => element.id === 'header').customData).toEqual({ nodeId: 'header', header: true })
  for (const [colour, [strokeColor, backgroundColor]] of Object.entries(SCENE_COLOURS)) {
    expect(skeletons.find(element => element.id === colour)).toMatchObject({ strokeColor, backgroundColor })
  }
  expect(skeletons.at(-1)).toMatchObject({ strokeColor: '#495057', backgroundColor: '#e9ecef' })
})

it('draws dashed sequence lifelines', () => {
  const scene = graphToScene('sequence', { nodes: [node('actor', 'ActorNode')], edges: [] })
  expect(scene.find(element => element.type === 'line')).toMatchObject({ strokeStyle: 'dashed', roughness: 1 })
})

it('resolves bound text to its generated container and excludes headers and user shapes', () => {
  const shape = { id: 'shape', customData: { nodeId: 'original' } }
  const text = { type: 'text', containerId: 'shape' }
  expect(sceneNodeId(text, [shape, text])).toBe('original')
  expect(sceneNodeId({ customData: { nodeId: 'header', header: true } }, [])).toBeNull()
  expect(sceneNodeId({ id: 'user' }, [])).toBeNull()
  expect(sceneNodeId(null, [])).toBeNull()
})

it.each([
  ['/', 'https://example.com/notebooks/2', 'https://example.com/excalidraw-assets/'],
  ['/demo/', 'http://localhost:5173/demo/canvas/2', 'http://localhost:5173/demo/excalidraw-assets/'],
  ['/', 'file:///C:/app/renderer/index.html#/notebooks/2', 'file:///C:/app/renderer/excalidraw-assets/'],
])('resolves local assets for %s at %s', (base, page, expected) => {
  expect(resolveAssetPath(base, page)).toBe(expected)
})
