import './excalidrawAssets'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'

import { SCENE_COLOURS } from './sceneColours'
export { SCENE_COLOURS } from './sceneColours'

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

function measurePyramidText(text, fontSize) {
  const [element] = convertToExcalidrawElements([
    { id: 'pyramid-measure', type: 'text', text, fontSize, x: 0, y: 0 },
  ], { regenerateIds: false })
  return { width: element.width ?? text.length * fontSize,
    height: element.height ?? text.split('\n').length * fontSize * 1.25 }
}

function pyramidText(data, fontSize) {
  const maxWidth = data.topWidth * 0.85
  const lines = []
  let line = ''
  for (const word of (data.label || '').split(/\s+/)) {
    if (line && measurePyramidText(`${line} ${word}`, fontSize).width > maxWidth) {
      lines.push(line)
      line = ''
    }
    if (line) line += ' '
    for (const character of word) {
      if (line && measurePyramidText(line + character, fontSize).width > maxWidth) {
        lines.push(line)
        line = ''
      }
      line += character
    }
  }
  if (line) lines.push(line)
  if (data.value) lines.unshift(data.value)
  return lines.join('\n')
}

function pyramidSkeletons(node) {
  const data = node.data
  const { topWidth, bottomWidth } = data
  const inset = (bottomWidth - topWidth) / 2
  const [strokeColor, backgroundColor] = SCENE_COLOURS[data.color] || SCENE_COLOURS.slate
  const groupIds = [`pyramid-${node.id}`]
  const text20 = pyramidText(data, 20)
  const fontSize = measurePyramidText(text20, 20).height > 56 ? 16 : 20
  const text = fontSize === 20 ? text20 : pyramidText(data, 16)
  return [{
    id: node.id, type: 'line', x: node.position.x + inset, y: node.position.y,
    width: bottomWidth, height: 72,
    points: [[0, 0], [topWidth, 0], [topWidth + inset, 72], [-inset, 72], [0, 0]],
    strokeColor, backgroundColor, fillStyle: 'solid', roughness: 1, groupIds,
    customData: { nodeId: node.id, sourceSectionId: data.source_section_id, label: data.label, detail: data.detail, value: data.value },
  }, {
    id: `${node.id}-text`, type: 'text', text, fontSize, textAlign: 'center',
    x: node.position.x + bottomWidth / 2, y: node.position.y + 36,
    strokeColor: '#1e1e1e', groupIds, customData: { nodeId: node.id },
  }]
}

export function graphSkeletons(template, graph) {
  if (template === 'pyramid') return graph.nodes.flatMap(pyramidSkeletons)
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
  const elements = convertToExcalidrawElements(graphSkeletons(template, graph), { regenerateIds: false })
  if (template === 'pyramid') {
    const nodes = new Map(graph.nodes.map(node => [node.id, node]))
    return elements.map(element => {
      if (element.type !== 'text') return element
      const node = nodes.get(element.customData.nodeId)
      return { ...element, x: node.position.x + (node.data.bottomWidth - element.width) / 2,
        y: node.position.y + (72 - element.height) / 2 }
    })
  }
  return elements
}

export function sceneNodeId(element, elements) {
  if (element?.customData?.nodeId) return element.customData.header ? null : element.customData.nodeId
  const shape = element?.type === 'text' && element.containerId
    ? elements.find(item => item.id === element.containerId && !item.isDeleted) : element
  return shape?.customData?.header ? null : shape?.customData?.nodeId || null
}

export function sceneForSave(elements) {
  return elements.filter(element => !element.isDeleted).map(element => {
    if (!element.customData?.nodeId || element.customData.header) return element
    if (element.type === 'line') {
      const text = elements.find(item => !item.isDeleted && item.type === 'text'
        && item.customData?.nodeId === element.customData.nodeId
        && item.groupIds?.some(id => element.groupIds?.includes(id)))
      if (text) {
        const lines = text.text.split('\n')
        if (lines[0] === element.customData.value) lines.shift()
        return { ...element, customData: { ...element.customData, label: lines.join(' ') } }
      }
    }
    const text = elements.find(item => !item.isDeleted && item.type === 'text' && item.containerId === element.id)
    return text ? { ...element, customData: { ...element.customData, label: text.text } } : element
  })
}
