import { SCENE_COLOURS } from '../canvas/sceneColours'

export function defaultStyle(colourName) {
  const [stroke, fill] = SCENE_COLOURS[colourName] || SCENE_COLOURS.slate
  return {
    fill: { type: 'solid', colors: [fill], angle: 0 }, opacity: 1,
    stroke: { color: stroke, width: 2, dash: 'solid' },
    text: { font: 'sans', size: 18, color: '#1e1e1e', weight: 500 },
    shadow: 'soft', extrusion: 16,
  }
}

function edgeStyle() {
  return { ...defaultStyle('slate'), arrow: { end: 'triangle', start: 'none' } }
}

function applyDepth(template, nodes, edges) {
  const degree = new Map(nodes.map(node => [node.id, 0]))
  for (const edge of edges) {
    for (const id of [edge.from, edge.to]) degree.set(id, (degree.get(id) || 0) + 1)
  }
  const hub = nodes.reduce((best, node) => !best || degree.get(node.id) > degree.get(best.id) ? node : best, null)
  const tiers = nodes.filter(node => node.kind === 'tier').sort((a, b) => a.y - b.y)
  return nodes.map(node => {
    let z = 0, extrusion = 16
    if (template === 'pyramid' && node.kind === 'tier') {
      z = (tiers.length - 1 - tiers.indexOf(node)) * 18
      extrusion = 20
    } else if (['concept_map', 'causal_loop'].includes(template) && node === hub) {
      z = 40
      extrusion = 28
    } else if (template === 'comparison_matrix') {
      z = node.kind === 'header' ? 12 : 0
      extrusion = 10
    }
    return { ...node, z, style: { ...node.style, extrusion } }
  })
}

function graphKind(template, node) {
  if (node.type === 'MatrixHeader') return 'header'
  if (node.type === 'PyramidBand') return 'tier'
  if (['MilestoneNode', 'ActorNode'].includes(node.type)) return 'ellipse'
  if (node.data?.kind === 'decision' || (template === 'decision_tree' && node.data?.kind === 'question')) return 'diamond'
  return 'card'
}

export function fromGraph(template, graph) {
  const nodes = graph.nodes.map(node => {
    const data = node.data || {}
    const kind = graphKind(template, node)
    return {
      id: node.id, kind, x: node.position.x, y: node.position.y, z: 0,
      w: data.bottomWidth ?? node.width ?? node.style?.width ?? 180,
      h: node.height ?? node.style?.height ?? 62,
      label: data.label || '', value: data.value, detail: data.detail,
      sourceSectionId: data.source_section_id,
      linked: kind !== 'header' && node.type !== 'GroupNode',
      ...(kind === 'tier' ? { topWidth: data.topWidth } : {}),
      style: defaultStyle(data.color),
    }
  })
  const edges = (graph.edges || []).map(edge => ({
    id: edge.id, from: edge.source, to: edge.target, label: edge.label || '', style: edgeStyle(),
  }))
  return { version: 1, template, nodes: applyDepth(template, nodes, edges), edges }
}

function importedStyle(element, edge = false) {
  const style = edge ? edgeStyle() : defaultStyle('slate')
  if (element.backgroundColor && element.backgroundColor !== 'transparent') style.fill.colors = [element.backgroundColor]
  if (element.strokeColor) style.stroke.color = element.strokeColor
  style.stroke.width = element.strokeWidth ?? 2
  style.opacity = (element.opacity ?? 100) / 100
  if (element.fontSize) style.text.size = element.fontSize
  if (element.type === 'text' && element.strokeColor) style.text.color = element.strokeColor
  return style
}

function closedTier(element) {
  const points = element.points || []
  return element.type === 'line' && element.customData?.nodeId && points.length >= 4
    && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]
}

function importNode(element, text) {
  const data = element.customData || {}
  const tier = closedTier(element)
  const xs = tier ? element.points.map(point => point[0]) : [0, element.width]
  const ys = tier ? element.points.map(point => point[1]) : [0, element.height]
  const kind = data.header ? 'header' : tier ? 'tier'
    : { rectangle: 'card', ellipse: 'ellipse', diamond: 'diamond', text: 'note' }[element.type]
  return {
    id: data.nodeId || element.id, kind,
    x: element.x + Math.min(...xs), y: element.y + Math.min(...ys), z: 0,
    w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys),
    label: text?.text ?? data.label ?? element.text ?? '', value: data.value, detail: data.detail,
    sourceSectionId: data.sourceSectionId, linked: Boolean(data.nodeId) && !data.header && kind !== 'note',
    ...(tier ? { topWidth: Math.abs(element.points[1][0] - element.points[0][0]) } : {}),
    style: importedStyle(element),
  }
}

export function fromExcalidraw(template, elements) {
  const nodes = [], edges = []
  let skipped = 0
  const live = elements.filter(element => !element.isDeleted)
  const textByContainer = new Map(live.filter(element => element.type === 'text' && element.containerId)
    .map(element => [element.containerId, element]))
  const idMap = new Map()
  for (const element of live) {
    if (['rectangle', 'ellipse', 'diamond'].includes(element.type) || closedTier(element)) {
      const node = importNode(element, textByContainer.get(element.id))
      nodes.push(node)
      idMap.set(element.id, node.id)
    }
  }
  for (const element of elements) {
    if (element.isDeleted) { skipped++; continue }
    if (idMap.has(element.id)) continue
    if (element.type === 'text') {
      // Pyramid labels in old scenes use nodeId instead of containerId.
      if (element.containerId || nodes.some(node => node.id === element.customData?.nodeId)) continue
      nodes.push(importNode(element))
    } else if (element.type === 'arrow') {
      const from = idMap.get(element.start?.id || element.startBinding?.elementId)
      const to = idMap.get(element.end?.id || element.endBinding?.elementId)
      if (from && to) edges.push({ id: element.id, from, to,
        label: textByContainer.get(element.id)?.text || '', style: importedStyle(element, true) })
      else skipped++
    } else skipped++
  }
  return { doc: { version: 1, template, nodes: applyDepth(template, nodes, edges), edges }, skipped }
}
