import { useCallback, useRef, useState } from 'react'

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

export const meaningColours = ['MatrixCell', 'MessageNode', 'NoteNode']
export const COLORS = ['blue', 'teal', 'amber', 'violet', 'rose', 'slate']

export default function useCanvasEditing({ nodes, edges, setNodes, setEdges, setCanvas, save }) {
  const [editing, setEditing] = useState(null)
  const spots = useRef(new Map())
  const applyGraph = useCallback(
    (nextNodes, nextEdges) => {
      setNodes(nextNodes)
      setEdges(nextEdges)
      const edited = editedGraph(nextNodes, nextEdges)
      setCanvas(record => ({ ...record, edited, has_edits: true }))
      save({ edited })
    },
    [setNodes, setEdges, setCanvas, save]
  )
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
    const key = `${position.x}:${position.y}`
    const count = spots.current.get(key) || 0
    spots.current.set(key, count + 1)
    const node = {
      id: `n-${crypto.randomUUID()}`,
      type: note ? 'NoteNode' : 'StepNode',
      position: { x: position.x + count * 24, y: position.y + count * 24 },
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
