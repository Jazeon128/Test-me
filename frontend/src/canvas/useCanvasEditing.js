import { useCallback, useEffect, useRef, useState } from 'react'

const NODE_FIELDS = [
  'id',
  'type',
  'position',
  'data',
  'parentId',
  'width',
  'height',
  'zIndex',
  'draggable',
  'selectable',
  'style',
]
const EDGE_FIELDS = ['id', 'source', 'target', 'label', 'animated', 'data']
const pick = (item, fields) =>
  Object.fromEntries(fields.filter(key => item[key] !== undefined).map(key => [key, item[key]]))
export function editedGraph(nodes, edges) {
  // JSON serialization also removes callbacks nested in template data.
  return JSON.parse(
    JSON.stringify({
      schema_version: 1,
      nodes: nodes.map(node => pick(node, NODE_FIELDS)),
      edges: edges.map(edge => pick(edge, EDGE_FIELDS)),
    })
  )
}

export const meaningColours = ['MatrixCell', 'MatrixHeader', 'MessageNode', 'NoteNode']
export const COLORS = ['blue', 'teal', 'amber', 'violet', 'rose', 'slate']

export function freePosition(centre, nodes) {
  let x = 0
  let y = 0
  let dx = 1
  let dy = 0
  let length = 1
  let travelled = 0
  let turns = 0
  for (let attempt = 0; attempt < 40; attempt++) {
    const position = { x: centre.x + x * 40, y: centre.y + y * 40 }
    const occupied = nodes.some(node => {
      let origin = node.position
      let parent = nodes.find(item => item.id === node.parentId)
      while (parent) {
        origin = { x: origin.x + parent.position.x, y: origin.y + parent.position.y }
        parent = nodes.find(item => item.id === parent.parentId)
      }
      const width = node.measured?.width ?? 180
      const height = node.measured?.height ?? 60
      return (
        position.x < origin.x + width &&
        position.x + 180 > origin.x &&
        position.y < origin.y + height &&
        position.y + 60 > origin.y
      )
    })
    if (!occupied) return position
    x += dx
    y += dy
    travelled++
    if (travelled === length) {
      const previousDx = dx
      dx = -dy
      dy = previousDx
      travelled = 0
      turns++
      if (turns % 2 === 0) length++
    }
  }
  return centre
}

export default function useCanvasEditing({
  nodes,
  edges,
  setNodes,
  setEdges,
  setCanvas,
  save,
  canvasId,
}) {
  const [editing, setEditing] = useState(null)
  const history = useRef({ past: [], future: [] })
  const drag = useRef(null)
  const [availability, setAvailability] = useState({ canUndo: false, canRedo: false })
  const refresh = useCallback(
    () =>
      setAvailability({
        canUndo: history.current.past.length > 0,
        canRedo: history.current.future.length > 0,
      }),
    []
  )
  const clearHistory = useCallback(() => {
    history.current = { past: [], future: [] }
    drag.current = null
    setEditing(null)
    refresh()
  }, [refresh])
  useEffect(() => {
    clearHistory()
  }, [canvasId, clearHistory])
  const beginDrag = () => {
    drag.current = editedGraph(nodes, edges)
  }
  const pushHistory = useCallback(() => {
    history.current.past = [
      ...history.current.past,
      drag.current || editedGraph(nodes, edges),
    ].slice(-50)
    history.current.future = []
    drag.current = null
    refresh()
  }, [nodes, edges, refresh])
  const applyGraph = useCallback(
    (nextNodes, nextEdges, recordHistory = true, layoutOnly = false) => {
      if (recordHistory) pushHistory()
      setNodes(nextNodes)
      setEdges(nextEdges)
      const edited = editedGraph(nextNodes, nextEdges)
      if (layoutOnly) {
        const layout = Object.fromEntries(nextNodes.map(node => [node.id, node.position]))
        setCanvas(record => ({ ...record, layout }))
        save({ layout })
      } else {
        setCanvas(record => ({ ...record, edited, has_edits: true }))
        save({ edited })
      }
    },
    [setNodes, setEdges, setCanvas, save, pushHistory]
  )
  const travel = direction => {
    const from = history.current[direction === 'undo' ? 'past' : 'future']
    const to = history.current[direction === 'undo' ? 'future' : 'past']
    if (!from.length) return
    to.push(editedGraph(nodes, edges))
    const snapshot = from.pop()
    setEditing(null)
    applyGraph(snapshot.nodes, snapshot.edges, false)
    refresh()
  }
  const commit = useCallback(
    (id, text) => {
      const next = nodes.map(node =>
        node.id === id ? { ...node, data: { ...node.data, ...text, edited: true } } : node
      )
      applyGraph(next, edges)
      setEditing(null)
    },
    [nodes, edges, applyGraph]
  )
  const add = (position, note = false) => {
    const node = {
      id: `n-${crypto.randomUUID()}`,
      type: note ? 'NoteNode' : 'StepNode',
      position: freePosition(position, nodes),
      data: note
        ? { label: 'Note', note: true, added: true }
        : { label: 'New node', color: 'slate', kind: 'added', added: true },
      selected: true,
    }
    applyGraph(
      [...nodes.map(item => ({ ...item, selected: false })), node],
      edges.map(edge => ({ ...edge, selected: false }))
    )
    setEditing(node.id)
    return node
  }
  const connect = ({ source, target }) => {
    if (
      source === target ||
      !nodes.some(node => node.id === source) ||
      !nodes.some(node => node.id === target) ||
      edges.some(edge => edge.source === source && edge.target === target)
    )
      return
    applyGraph(nodes, [...edges, { id: `e-${crypto.randomUUID()}`, source, target }])
  }
  const canDelete = node => !node || !nodes.some(item => item.parentId === node.id)
  const remove = (node, edge) => {
    if (node && canDelete(node)) {
      applyGraph(
        nodes.filter(item => item.id !== node.id),
        edges.filter(item => item.source !== node.id && item.target !== node.id)
      )
      setEditing(null)
      return true
    }
    if (edge) {
      applyGraph(
        nodes,
        edges.filter(item => item.id !== edge.id)
      )
      return true
    }
    return false
  }
  const recolour = (node, color) => {
    if (meaningColours.includes(node.type) || !COLORS.includes(color)) return
    applyGraph(
      nodes.map(item =>
        item.id === node.id ? { ...item, data: { ...item.data, color, edited: true } } : item
      ),
      edges
    )
  }
  const labelEdge = (edge, label) => {
    if (label.length <= 80) {
      applyGraph(
        nodes,
        edges.map(item => (item.id === edge.id ? { ...item, label } : item))
      )
    }
  }
  const displayNodes = nodes.map(node => ({
    ...node,
    ...(node.type === 'GroupNode' ? { selectable: true } : {}),
    data: {
      ...node.data,
      editing: editing === node.id,
      onSaveText: text => commit(node.id, text),
      onCancelText: () => setEditing(null),
    },
  }))
  return {
    ...availability,
    undo: () => travel('undo'),
    redo: () => travel('redo'),
    clearHistory,
    beginDrag,
    displayNodes,
    editing,
    startEditing: setEditing,
    applyGraph,
    add,
    connect,
    canDelete,
    remove,
    recolour,
    labelEdge,
  }
}
