import { describe, expect, it } from 'vitest'
import { defaultStyle, fromGraph, fromExcalidraw } from './model'

const node = (id, type = 'Card', y = 0) => ({ id, type, position: { x: 10, y }, height: 72,
  data: { label: id, source_section_id: id, color: 'blue', topWidth: 80, bottomWidth: 120 } })

describe('fromGraph', () => {
  it('steps pyramid tiers above the base', () => {
    const doc = fromGraph('pyramid', { nodes: [node('top', 'PyramidBand'), node('middle', 'PyramidBand', 72), node('base', 'PyramidBand', 144)], edges: [] })
    expect(doc.version).toBe(1)
    expect(doc.nodes.map(n => [n.kind, n.z, n.style.extrusion])).toEqual([['tier', 36, 20], ['tier', 18, 20], ['tier', 0, 20]])
    expect(doc.nodes[0]).toMatchObject({ topWidth: 80, w: 120, h: 72, linked: true })
  })
  it.each(['concept_map', 'causal_loop'])('raises the most connected node in %s', template => {
    const doc = fromGraph(template, { nodes: [node('a'), node('hub'), node('b')], edges: [
      { id: 'one', source: 'a', target: 'hub' }, { id: 'two', source: 'hub', target: 'b' },
    ] })
    expect(doc.nodes.map(n => [n.z, n.style.extrusion])).toEqual([[0, 16], [40, 28], [0, 16]])
    expect(doc.edges[0]).toMatchObject({ from: 'a', to: 'hub', style: { arrow: { end: 'triangle', start: 'none' } } })
  })
  it('raises matrix headers and leaves them unlinked', () => {
    const doc = fromGraph('comparison_matrix', { nodes: [node('header', 'MatrixHeader'), node('cell')], edges: [] })
    expect(doc.nodes[0]).toMatchObject({ kind: 'header', z: 12, linked: false, style: { extrusion: 10 } })
    expect(doc.nodes[1]).toMatchObject({ z: 0, linked: true, style: { extrusion: 10 } })
  })
  it('maps the shared palette without sharing mutable styles', () => {
    expect(defaultStyle('blue').fill.colors).toEqual(['#a5d8ff'])
    const style = defaultStyle('blue'); style.fill.colors[0] = '#000000'
    expect(defaultStyle('blue').fill.colors).toEqual(['#a5d8ff'])
  })
})

describe('fromExcalidraw', () => {
  const fixture = [
    { id: 'rect', type: 'rectangle', x: 10, y: 20, width: 100, height: 60,
      backgroundColor: '#a5d8ff', strokeColor: '#1971c2', customData: { nodeId: 'a', label: 'Old', detail: 'Detail', sourceSectionId: 'section' } },
    { id: 'text', type: 'text', containerId: 'rect', text: 'Bound label' },
    { id: 'tier', type: 'line', x: 40, y: 100, points: [[0, 0], [80, 0], [100, 72], [-20, 72], [0, 0]], customData: { nodeId: 'b', label: 'Tier' } },
    { id: 'arrow', type: 'arrow', startBinding: { elementId: 'rect' }, endBinding: { elementId: 'tier' } },
    { id: 'arrow-text', type: 'text', containerId: 'arrow', text: 'Connects' },
    { id: 'ink', type: 'freedraw' }, { id: 'loose', type: 'arrow' },
  ]
  it('imports source links, bound labels, a tier and an edge, skipping 2 items', () => {
    const { doc, skipped } = fromExcalidraw('pyramid', fixture)
    expect(skipped).toBe(2)
    expect(doc.nodes).toHaveLength(2)
    expect(doc.nodes[0]).toMatchObject({ id: 'a', x: 10, y: 20, w: 100, h: 60, label: 'Bound label', linked: true,
      detail: 'Detail', sourceSectionId: 'section', style: { fill: { colors: ['#a5d8ff'] }, stroke: { color: '#1971c2' } } })
    expect(doc.nodes[1]).toMatchObject({ id: 'b', kind: 'tier', x: 20, y: 100, w: 120, h: 72, topWidth: 80, z: 0, style: { extrusion: 20 } })
    expect(doc.edges[0]).toMatchObject({ id: 'arrow', from: 'a', to: 'b', label: 'Connects' })
  })
  it('applies hub depth on import and imports free text as a note', () => {
    const { doc, skipped } = fromExcalidraw('concept_map', [...fixture,
      { id: 'note', type: 'text', x: 0, y: 0, width: 80, height: 30, text: 'A note' }, { id: 'deleted', isDeleted: true }])
    expect(doc.nodes[0]).toMatchObject({ z: 40, style: { extrusion: 28 } })
    expect(doc.nodes.at(-1)).toMatchObject({ kind: 'note', linked: false, label: 'A note' })
    expect(skipped).toBe(3)
  })
})
