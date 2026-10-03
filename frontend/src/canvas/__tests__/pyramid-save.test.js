import { expect, it, vi } from 'vitest'
import { pyramidGraph } from '../layout'
import { graphToScene, sceneForSave } from '../scene'

vi.mock('@excalidraw/excalidraw', () => ({ convertToExcalidrawElements: elements => elements }))

it.each([
  ['5%', '5%\nRenamed\nlecture', 'Renamed lecture'],
  ['5%', '10%\nRenamed lecture', '10% Renamed lecture'],
  [null, 'Renamed\nlecture', 'Renamed lecture'],
])('saves grouped edited band text with value %s', (value, text, label) => {
  const scene = graphToScene('pyramid', pyramidGraph({ nodes: [
    { id: 'band', label: 'Lecture', value, source_section_id: 's1', detail: 'NTL claims this' },
  ] }))
  const edited = scene.map(element => element.type === 'text' ? { ...element, text } : element)
  edited.unshift({ id: 'wrong-group', type: 'text', text: 'Wrong group',
    customData: { nodeId: 'band' }, groupIds: ['other'] })
  edited.unshift({ id: 'wrong-node', type: 'text', text: 'Wrong node',
    customData: { nodeId: 'other' }, groupIds: ['pyramid-band'] })
  edited.unshift({ id: 'deleted', type: 'text', text: 'Deleted', isDeleted: true,
    customData: { nodeId: 'band' }, groupIds: ['pyramid-band'] })
  const polygon = sceneForSave(edited).find(element => element.id === 'band')
  expect(polygon.customData).toMatchObject({ label, value, sourceSectionId: 's1', detail: 'NTL claims this' })
  expect(scene.find(element => element.id === 'band').customData.label).toBe('Lecture')
})
