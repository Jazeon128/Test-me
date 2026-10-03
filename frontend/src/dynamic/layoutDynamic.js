import { layout, toGraph, withMatrixHeaders } from '../canvas/layout'
import { fromExcalidraw, fromGraph } from './model'
import { fitNode } from './fit'

function matrixGrid(graph, payload) {
  const columns = new Map(), rows = new Map()
  const coordinates = graph.nodes.map(node => {
    const data = node.data
    const column = data.header === 'row' ? -1 : data.header === 'column'
      ? Number(node.id.slice(4)) : Math.max(0, payload.options.indexOf(data.option))
    const row = data.header === 'column' ? -1 : data.header === 'row'
      ? Number(node.id.slice(4)) : Math.max(0, payload.criteria.indexOf(data.criterion))
    columns.set(column, Math.max(columns.get(column) || 0, node.width))
    rows.set(row, Math.max(rows.get(row) || 0, node.height))
    return { column, row }
  })
  const offsets = (sizes, gap) => {
    let offset = 0
    return new Map([...sizes].sort(([a], [b]) => a - b).map(([key, size]) => {
      const entry = [key, offset]
      offset += size + gap
      return entry
    }))
  }
  const xs = offsets(columns, 24), ys = offsets(rows, 16)
  return { ...graph, nodes: graph.nodes.map((node, i) => ({ ...node,
    width: columns.get(coordinates[i].column), height: rows.get(coordinates[i].row),
    position: { x: xs.get(coordinates[i].column), y: ys.get(coordinates[i].row) },
  })) }
}

export async function layoutDynamic(record, measure) {
  const template = record.template
  if (record.edited?.schema_version === 2) {
    const result = fromExcalidraw(template, record.edited.elements)
    result.doc.nodes = result.doc.nodes.map(node => fitNode({ ...node, imported: true }, measure))
    return result
  }
  let graph = record.edited || toGraph(template, record.payload)
  graph = { ...graph, groups: graph.groups || [] }
  if (template === 'comparison_matrix') graph = withMatrixHeaders(graph, record.payload)
  const fixed = ['pyramid', 'sequence', 'fishbone'].includes(template)
  const algorithm = ['mindmap', 'hierarchy'].includes(template) ? 'mrtree'
    : ['concept_map', 'causal_loop'].includes(template) ? 'layeredDown' : 'layered'
  const options = { algorithm, orientation: record.payload?.orientation || 'horizontal' }
  if (fixed && !record.edited) graph = await layout(template, graph, options)
  const fitted = fromGraph(template, graph).nodes.map(node => fitNode({ ...node, keepSize: fixed }, measure))
  graph = { ...graph, nodes: graph.nodes.map((node, i) => ({ ...node,
    width: fitted[i].w, height: fitted[i].h,
  })) }
  if (template === 'comparison_matrix') graph = matrixGrid(graph, record.payload)
  else if (!fixed) graph = await layout(template, { ...graph, preLaidOut: false }, options)
  const saved = record.edited ? {} : record.layout || {}
  graph = { ...graph, nodes: graph.nodes.map(node => ({ ...node, position: saved[node.id] || node.position })) }
  const doc = fromGraph(template, graph)
  doc.nodes = doc.nodes.map((node, i) => ({ ...node, textSize: fitted[i].textSize, lines: fitted[i].lines }))
  return { doc, skipped: 0 }
}
