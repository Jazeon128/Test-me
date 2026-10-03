import { expect, it } from 'vitest'
import { matrixGraph, withMatrixHeaders } from '../layout'

const payload = {
  options: ['Athena', 'Glue'], criteria: ['Purpose', 'Pricing'],
  cells: [{ option: 'Glue', criterion: 'Pricing', value: 'Usage', verdict: 'good' }],
}
const headers = [
  { id: 'col-0', type: 'MatrixHeader', position: { x: 0, y: -70 }, data: { label: 'Athena', header: 'column' }, draggable: false },
  { id: 'col-1', type: 'MatrixHeader', position: { x: 220, y: -70 }, data: { label: 'Glue', header: 'column' }, draggable: false },
  { id: 'row-0', type: 'MatrixHeader', position: { x: -220, y: 0 }, data: { label: 'Purpose', header: 'row' }, draggable: false },
  { id: 'row-1', type: 'MatrixHeader', position: { x: -220, y: 90 }, data: { label: 'Pricing', header: 'row' }, draggable: false },
]
it('builds matrix headers and preserves cells and prelaid layout', () => {
  const graph = matrixGraph(payload)
  expect(graph.nodes.slice(0, 4)).toEqual(headers)
  expect(graph.nodes.slice(4)).toEqual([{ id: 'cell-0', type: 'MatrixCell', position: { x: 220, y: 90 }, data: { ...payload.cells[0], label: 'Usage' } }])
  expect(graph).toMatchObject({ edges: [], groups: [], preLaidOut: true })
})
it('adds headers to old edited graphs without mutating them and leaves existing headers unchanged', () => {
  const graph = { schema_version: 1, nodes: [{ id: 'cell-0', position: { x: 999, y: 111 }, data: { label: 'Edited' } }], edges: [] }
  const result = withMatrixHeaders(graph, payload)
  expect(result).toEqual({ ...graph, nodes: [...headers, ...graph.nodes] })
  expect(graph.nodes).toHaveLength(1)
  expect(result.nodes[4]).toBe(graph.nodes[0])
  expect(withMatrixHeaders(result, payload)).toBe(result)
  const partial = { ...graph, nodes: [headers[0]] }
  expect(withMatrixHeaders(partial, payload)).toBe(partial)
})
