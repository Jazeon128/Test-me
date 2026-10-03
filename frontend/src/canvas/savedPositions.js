/** Apply saved node positions and carry label centres with their endpoints. */
export function applySavedPositions(graph, saved = {}) {
  const nodes = graph.nodes.map(node => ({ ...node, position: saved[node.id] || node.position }))
  const positions = new Map(nodes.map(node => [node.id, node.position]))
  const edges = graph.edges.map(edge => {
    if (!edge.labelPosition || !edge.labelAnchor) return edge
    const source = positions.get(edge.source)
    const target = positions.get(edge.target)
    return { ...edge, labelPosition: {
      x: edge.labelPosition.x + (source.x - edge.labelAnchor.source.x + target.x - edge.labelAnchor.target.x) / 2,
      y: edge.labelPosition.y + (source.y - edge.labelAnchor.source.y + target.y - edge.labelAnchor.target.y) / 2,
    } }
  })
  return { ...graph, nodes, edges }
}

