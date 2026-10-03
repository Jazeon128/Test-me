import { act, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { layout, pyramidGraph, toGraph } from '../layout'
import { graphSkeletons, graphToScene, sceneNodeId } from '../scene'
import CanvasView from '../CanvasView'
import { canvasAPI } from '../../services/api'

const state = vi.hoisted(() => ({ props: null }))
vi.mock('@excalidraw/excalidraw', () => {
  const MainMenu = ({ children }) => <>{children}</>
  MainMenu.DefaultItems = { Export: () => null, Help: () => null }
  return {
    Excalidraw: props => { state.props = props; return <div data-testid="pyramid-whiteboard" /> },
    MainMenu, convertToExcalidrawElements: elements => elements.map(element => ({ ...element, version: 1,
      ...(element.type === 'text' ? {
        width: Math.max(...element.text.split('\n').map(line => line.length * element.fontSize)),
        height: element.text.split('\n').length * element.fontSize * 1.25,
      } : {}),
    })),
  }
})
vi.mock('../../services/api', () => ({
  canvasAPI: { get: vi.fn(), update: vi.fn(), nodeSource: vi.fn() },
  documentsAPI: {}, notebooksAPI: {}, statusAPI: {},
}))
vi.mock('../NodePanel', () => ({ default: ({ node }) => <aside aria-label="Band source">{node.data.label}</aside> }))

const payload = { nodes: [
  { id: 'base', level: 2, label: 'Practice', value: '90%', color: 'teal', source_section_id: 's2', detail: 'Apply ideas' },
  { id: 'missing', label: 'Missing' },
  { id: 'top', level: 1, label: 'Lecture', value: '5%', color: 'blue', source_section_id: 's1' },
  { id: 'invalid', level: '3', label: 'Invalid' },
  { id: 'nan', level: NaN, label: 'NaN' },
], edges: [{ source: 'top', target: 'base' }] }

it('orders numbered bands first, keeps unlevelled order, sizes and centres every band without edges', async () => {
  const graph = pyramidGraph(payload)
  expect(graph.nodes.map(node => node.id)).toEqual(['top', 'base', 'missing', 'invalid', 'nan'])
  graph.nodes.forEach((node, index) => {
    expect(node.type).toBe('PyramidBand')
    expect(node.data.topWidth).toBe(240 + index * 120)
    expect(node.data.bottomWidth).toBe(240 + (index + 1) * 120)
    expect(node.position).toEqual({ x: -node.data.bottomWidth / 2, y: index * 72 })
    expect(node.height).toBe(72)
  })
  expect(graph.edges).toEqual([])
  expect(graph.preLaidOut).toBe(true)
  expect(toGraph('pyramid', payload)).toEqual(graph)
  expect(await layout('pyramid', graph, { algorithm: 'box' })).toBe(graph)
  expect(payload.nodes[0].id).toBe('base')
})

it('draws closed coloured trapezoids with provenance and centred grouped value and label text', () => {
  const graph = pyramidGraph(payload)
  const scene = graphToScene('pyramid', graph)
  expect(scene.filter(element => element.type === 'line')).toHaveLength(5)
  graph.nodes.forEach(node => {
    const polygon = scene.find(element => element.id === node.id)
    const text = scene.find(element => element.id === `${node.id}-text`)
    const { topWidth, bottomWidth } = node.data
    expect(polygon.points).toEqual([[0, 0], [topWidth, 0], [topWidth + 60, 72], [-60, 72], [0, 0]])
    expect(polygon.x + topWidth / 2).toBe(0)
    expect(polygon.customData).toEqual({ nodeId: node.id, sourceSectionId: node.data.source_section_id,
      label: node.data.label, detail: node.data.detail, value: node.data.value })
    expect(polygon).toMatchObject({ fillStyle: 'solid', roughness: 1 })
    expect(text.text).toContain(node.data.label)
    if (node.data.value) expect(text.text.split('\n')[0]).toBe(node.data.value)
    expect(text.x + text.width / 2).toBe(0)
    expect(text.y + text.height / 2).toBe(node.position.y + 36)
    expect(text.groupIds).toEqual(polygon.groupIds)
    expect(text.groupIds).toHaveLength(1)
    expect(sceneNodeId(text, scene)).toBe(node.id)
    expect(polygon.width).toBe(bottomWidth)
  })
  expect(scene[0]).toMatchObject({ strokeColor: '#1971c2', backgroundColor: '#a5d8ff' })
  expect(scene[2]).toMatchObject({ strokeColor: '#099268', backgroundColor: '#96f2d7' })
})

it('wraps a label to the top width and reduces overflowing text to 16 px', () => {
  const graph = pyramidGraph({ nodes: [{ id: 'long', value: '100%', label: 'Several lengthy concepts require careful explanation' }] })
  const text = graphToScene('pyramid', graph).find(element => element.type === 'text')
  expect(text.fontSize).toBe(16)
  expect(text.text.replace(/\n/g, ' ')).toBe('100% Several lengthy concepts require careful explanation')
  expect(text.width).toBeLessThanOrEqual(240 * 0.85)
  const skeleton = graphSkeletons('pyramid', graph).find(element => element.type === 'text')
  expect(skeleton).not.toHaveProperty('width')
  expect(skeleton).not.toHaveProperty('height')
})

it('opens the node panel for a grouped band and closes it for mixed or user selections', async () => {
  canvasAPI.update.mockResolvedValue({ data: {} })
  canvasAPI.get.mockResolvedValue({ data: { id: 7, template: 'pyramid', payload } })
  canvasAPI.nodeSource.mockResolvedValue({ data: { section: null } })
  render(<MemoryRouter><CanvasView canvasId="7" /></MemoryRouter>)
  await screen.findByTestId('pyramid-whiteboard')
  const elements = [...state.props.initialData.elements, { id: 'user', type: 'rectangle', version: 1 }]
  const select = ids => act(async () => state.props.onChange(elements, {
    selectedElementIds: Object.fromEntries(ids.map(id => [id, true])),
  }))
  await select(['top', 'top-text'])
  expect(await screen.findByLabelText('Band source')).toHaveTextContent('Lecture')
  expect(canvasAPI.nodeSource).toHaveBeenCalledWith(7, 'top')
  for (const ids of [['top', 'base'], ['top', 'user'], ['user'], []]) {
    await select(['top', 'top-text'])
    await select(ids)
    expect(screen.queryByLabelText('Band source')).not.toBeInTheDocument()
  }
})
