import './excalidrawAssets'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'

export const SCENE_COLOURS = {
  blue: ['#1971c2', '#a5d8ff'],
  teal: ['#099268', '#96f2d7'],
  amber: ['#f08c00', '#ffec99'],
  violet: ['#6741d9', '#d0bfff'],
  rose: ['#e03131', '#ffc9c9'],
  slate: ['#495057', '#e9ecef'],
}

function connectionPoint(shape, towards) {
  const x = shape.x + shape.width / 2
  const y = shape.y + shape.height / 2
  const dx = towards.x + towards.width / 2 - x
  const dy = towards.y + towards.height / 2 - y
  const rx = shape.width / 2 + 8
  const ry = shape.height / 2 + 8
  if (dx === 0 && dy === 0) return { x, y }
  const scale = shape.type === 'ellipse' ? 1 / Math.hypot(dx / rx, dy / ry)
    : shape.type === 'diamond' ? 1 / (Math.abs(dx) / rx + Math.abs(dy) / ry)
      : 1 / Math.max(Math.abs(dx) / rx, Math.abs(dy) / ry)
  return { x: x + dx * scale, y: y + dy * scale }
}

export function graphSkeletons(template, graph) {
  const nodes = [...graph.nodes].sort((a, b) => Number(b.type === 'GroupNode') - Number(a.type === 'GroupNode'))
  const shapes = nodes.map(node => {
    const data = node.data || {}
    const group = node.type === 'GroupNode'
    const [strokeColor, backgroundColor] = SCENE_COLOURS[data.color] || SCENE_COLOURS.slate
    const type = ['MilestoneNode', 'ActorNode'].includes(node.type) ? 'ellipse'
      : data.kind === 'decision' || (template === 'decision_tree' && data.kind === 'question') ? 'diamond' : 'rectangle'
    return {
      id: node.id, type, x: node.position.x, y: node.position.y,
      width: node.width ?? node.style?.width ?? 180,
      height: node.height ?? node.style?.height ?? 62,
      strokeColor, backgroundColor, fillStyle: 'solid', roughness: 1,
      label: { text: data.label || '', strokeColor: '#1e1e1e', ...(group ? { verticalAlign: 'top' } : {}) },
      customData: node.type === 'MatrixHeader' ? { nodeId: node.id, header: true }
        : { nodeId: node.id, sourceSectionId: data.source_section_id, label: data.label, detail: data.detail },
    }
  })
  const byId = new Map(shapes.map(shape => [shape.id, shape]))
  const arrows = graph.edges.map(edge => {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    const { x, y } = connectionPoint(source, target)
    const end = connectionPoint(target, source)
    const dx = end.x - x
    const dy = end.y - y
    return {
      id: edge.id, type: 'arrow', x, y, width: Math.abs(dx), height: Math.abs(dy),
      points: [[0, 0], [dx, dy]], roughness: 1,
      start: { id: edge.source }, end: { id: edge.target },
      ...(edge.label ? { label: { text: edge.label, strokeColor: '#1e1e1e' } } : {}),
    }
  })
  const bottom = Math.max(180, ...shapes.map(shape => shape.y + shape.height)) + 60
  const lifelines = template === 'sequence' ? nodes.filter(node => node.type === 'ActorNode').map(node => ({
    id: `lifeline-${node.id}`, type: 'line', x: node.position.x + (node.width || 180) / 2,
    y: node.position.y + (node.height || 62),
    width: 0, height: bottom - node.position.y - (node.height || 62),
    points: [[0, 0], [0, bottom - node.position.y - (node.height || 62)]],
    strokeStyle: 'dashed', roughness: 1,
  })) : []
  return [...shapes, ...lifelines, ...arrows]
}

export function graphToScene(template, graph) {
  return convertToExcalidrawElements(graphSkeletons(template, graph), { regenerateIds: false })
}

export function sceneNodeId(element, elements) {
  const shape = element?.type === 'text' && element.containerId
    ? elements.find(item => item.id === element.containerId && !item.isDeleted) : element
  return shape?.customData?.header ? null : shape?.customData?.nodeId || null
}

export function sceneForSave(elements) {
  return elements.filter(element => !element.isDeleted).map(element => {
    if (!element.customData?.nodeId || element.customData.header) return element
    const text = elements.find(item => !item.isDeleted && item.type === 'text' && item.containerId === element.id)
    return text ? { ...element, customData: { ...element.customData, label: text.text } } : element
  })
}
