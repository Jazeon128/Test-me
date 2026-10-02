import { useCallback, useState } from 'react'

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

export default function useCanvasEditing({ nodes, edges, setNodes, setCanvas, save }) {
  const [editing, setEditing] = useState(null)
  const commit = useCallback(
    (id, text) => {
      const next = nodes.map(node =>
        node.id === id ? { ...node, data: { ...node.data, ...text, edited: true } } : node
      )
      const edited = editedGraph(next, edges)
      setNodes(next)
      setCanvas(record => ({ ...record, edited, has_edits: true }))
      save({ edited })
      setEditing(null)
    },
    [nodes, edges, setNodes, setCanvas, save]
  )
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
  return { displayNodes, editing, startEditing: setEditing }
}
