import ELK from 'elkjs/lib/elk.bundled.js'

/**
 * Turn a template payload into React Flow nodes and edges, then lay them out.
 *
 * Each template picks an elk algorithm. The one exception is the fishbone,
 * which no general graph layout draws correctly: its spine and angled bones are
 * positioned directly.
 */

const elk = new ELK()

const NODE_W = 180
const NODE_H = 62

const ALGORITHMS = {
  layered: 'layered',
  mrtree: 'mrtree',
  box: 'box',
  force: 'force',
}

const elkOptions = (algorithm, orientation) => ({
  'elk.algorithm': ALGORITHMS[algorithm] || 'layered',
  'elk.direction': orientation === 'vertical' ? 'DOWN' : 'RIGHT',
  'elk.spacing.nodeNode': '40',
  'elk.layered.spacing.nodeNodeBetweenLayers': '70',
  'elk.padding': '[top=32,left=24,bottom=24,right=24]',
})

/** Which node component a template's node uses. */
const nodeTypeFor = (template, node) => {
  if (template === 'architecture' || template === 'c4_context') return 'ServiceNode'
  if (template === 'timeline') return 'MilestoneNode'
  if (template === 'comparison_matrix') return 'MatrixCell'
  if (template === 'fishbone') return 'BoneNode'
  return node?.type || 'StepNode'
}

/** Participants as columns, messages down the page in order. */
const ACTOR_GAP = 260
const MESSAGE_GAP = 74

function sequenceGraph(payload) {
  const participants = payload.participants || []
  const columnOf = new Map(participants.map((p, index) => [p.id, index]))

  const nodes = participants.map((participant, index) => ({
    id: participant.id,
    type: 'ActorNode',
    position: { x: index * ACTOR_GAP, y: 0 },
    data: { ...participant },
    draggable: false,
  }))

  const edges = []
  ;(payload.messages || []).forEach((message, index) => {
    const y = 110 + index * MESSAGE_GAP
    const from = columnOf.get(message.from) ?? 0
    const to = columnOf.get(message.to) ?? 0

    nodes.push({
      id: message.id,
      type: 'MessageNode',
      // Sit the message midway between the two participants it travels between.
      position: { x: ((from + to) / 2) * ACTOR_GAP, y },
      data: { ...message, rightward: to >= from },
    })
  })

  return { nodes, edges, groups: [], preLaidOut: true }
}

/** Flatten a template payload into a flat node/edge list. */
export function toGraph(template, payload) {
  if (template === 'pyramid') return pyramidGraph(payload)
  if (template === 'fishbone') return fishboneGraph(payload)
  if (template === 'comparison_matrix') return matrixGraph(payload)
  if (template === 'sequence') return sequenceGraph(payload)

  const nodes = (payload.nodes || []).map((node) => ({
    id: node.id,
    type: nodeTypeFor(template, node),
    position: { x: 0, y: 0 },
    data: { ...node },
  }))

  const edges = (payload.edges || []).map((edge, index) => ({
    id: `e${index}-${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    label: edge.label || edge.condition || edge.trigger || edge.protocol || undefined,
    animated: edge.polarity === 'reinforcing',
    labelBgPadding: [4, 2],
    labelShowBg: true,
  }))

  const groups = (payload.groups || []).map((group) => ({
    id: group.id,
    type: 'GroupNode',
    position: { x: 0, y: 0 },
    data: { ...group },
    // Containers must not sit above their children or intercept their clicks.
    zIndex: -1,
    selectable: false,
    draggable: false,
  }))

  return { nodes: [...groups, ...nodes], edges, groups: payload.groups || [] }
}

export function pyramidGraph(payload) {
  const level = node => Number.isFinite(node.level) ? node.level : Infinity
  const nodes = [...(payload.nodes || [])].sort((a, b) => level(a) - level(b)).map((node, index) => {
    const topWidth = 240 + index * 120
    const bottomWidth = topWidth + 120
    return {
      id: node.id, type: 'PyramidBand',
      position: { x: -bottomWidth / 2, y: index * 72 },
      width: bottomWidth, height: 72,
      data: { ...node, topWidth, bottomWidth },
    }
  })
  return { nodes, edges: [], groups: [], preLaidOut: true }
}

function fishboneGraph(payload) {
  const nodes = []
  const edges = []

  nodes.push({
    id: 'effect',
    type: 'StepNode',
    position: { x: 0, y: 0 },
    data: { label: payload.effect, kind: 'end', color: 'rose' },
  })

  ;(payload.categories || []).forEach((category) => {
    nodes.push({
      id: category.id,
      type: 'StepNode',
      position: { x: 0, y: 0 },
      data: { label: category.label, kind: 'category', color: category.color },
    })
    edges.push({ id: `e-${category.id}`, source: category.id, target: 'effect' })
    ;(category.causes || []).forEach((cause) => {
      nodes.push({
        id: cause.id,
        type: 'BoneNode',
        position: { x: 0, y: 0 },
        data: { ...cause, categoryId: category.id },
      })
      edges.push({ id: `e-${cause.id}`, source: cause.id, target: category.id })
    })
  })

  return { nodes, edges, groups: [] }
}

function matrixHeaders(payload) {
  return [
    ...(payload.options || []).map((label, index) => ({
      id: `col-${index}`, type: 'MatrixHeader',
      position: { x: index * 220, y: -70 },
      data: { label, header: 'column' }, draggable: false,
    })),
    ...(payload.criteria || []).map((label, index) => ({
      id: `row-${index}`, type: 'MatrixHeader',
      position: { x: -220, y: index * 90 },
      data: { label, header: 'row' }, draggable: false,
    })),
  ]
}

export function withMatrixHeaders(graph, payload) {
  if (graph.nodes.some(node => node.type === 'MatrixHeader')) return graph
  return { ...graph, nodes: [...matrixHeaders(payload), ...graph.nodes] }
}

export function matrixGraph(payload) {
  const nodes = matrixHeaders(payload)
  const options = payload.options || []
  const criteria = payload.criteria || []

  ;(payload.cells || []).forEach((cell, index) => {
    const column = options.indexOf(cell.option)
    const row = criteria.indexOf(cell.criterion)
    nodes.push({
      id: `cell-${index}`,
      type: 'MatrixCell',
      position: { x: Math.max(column, 0) * 220, y: Math.max(row, 0) * 90 },
      data: { ...cell, label: cell.value },
    })
  })

  return { nodes, edges: [], groups: [], preLaidOut: true }
}

/** Fishbone spine, drawn directly: elk has no algorithm for this shape. */
function layoutFishbone(nodes) {
  const categories = nodes.filter((n) => n.data.kind === 'category')
  const spineLength = Math.max(categories.length * 150, 400)

  const laidOut = nodes.map((node) => {
    if (node.id === 'effect') {
      return { ...node, position: { x: spineLength + 80, y: 0 } }
    }
    return node
  })

  categories.forEach((category, index) => {
    const above = index % 2 === 0
    const x = 120 + Math.floor(index / 2) * 300
    const target = laidOut.find((n) => n.id === category.id)
    target.position = { x, y: above ? -190 : 190 }

    const causes = laidOut.filter((n) => n.type === 'BoneNode' && n.data.categoryId === category.id)
    causes.forEach((cause, causeIndex) => {
      cause.position = {
        x: x - 200 - causeIndex * 30,
        y: (above ? -1 : 1) * (250 + causeIndex * 46),
      }
    })
  })

  return laidOut
}

/**
 * Run elk over the graph and return nodes with real positions.
 *
 * Groups are laid out as elk parents so a container ends up sized around its
 * children rather than guessed at.
 */
export async function layout(template, graph, { algorithm, orientation }) {
  if (template === 'fishbone') {
    return { ...graph, nodes: layoutFishbone(graph.nodes) }
  }
  if (graph.preLaidOut) return graph

  const memberOf = new Map()
  graph.groups.forEach((group) => {
    (group.node_ids || []).forEach((nodeId) => memberOf.set(nodeId, group.id))
  })

  const children = []
  const byGroup = new Map()

  graph.nodes.forEach((node) => {
    if (node.type === 'GroupNode') {
      byGroup.set(node.id, { id: node.id, children: [], layoutOptions: elkOptions(algorithm, orientation) })
      return
    }
    const entry = { id: node.id, width: NODE_W, height: NODE_H }
    const groupId = memberOf.get(node.id)
    if (groupId && byGroup.has(groupId)) {
      byGroup.get(groupId).children.push(entry)
    } else {
      children.push(entry)
    }
  })

  byGroup.forEach((group) => {
    if (group.children.length) children.push(group)
  })

  const result = await elk.layout({
    id: 'root',
    layoutOptions: elkOptions(algorithm, orientation),
    children,
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  })

  const positions = new Map()
  const collect = (elkNode, offsetX = 0, offsetY = 0) => {
    (elkNode.children || []).forEach((child) => {
      const x = offsetX + (child.x || 0)
      const y = offsetY + (child.y || 0)
      positions.set(child.id, { x, y, width: child.width, height: child.height })
      collect(child, x, y)
    })
  }
  collect(result)

  const nodes = graph.nodes.map((node) => {
    const position = positions.get(node.id)
    if (!position) return node
    const next = { ...node, position: { x: position.x, y: position.y } }
    if (node.type === 'GroupNode') {
      next.style = { width: position.width, height: position.height }
    }
    return next
  })

  return { ...graph, nodes }
}
