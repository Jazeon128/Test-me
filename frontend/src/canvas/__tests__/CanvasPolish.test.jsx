import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { canvasTitle } from '../canvasTitle'
import CanvasToolbar from '../CanvasToolbar'
import NodeEditor from '../NodeEditor'

it.each([
  ['draw me a table of the cheat sheet?', 'A table of the cheat sheet'],
  ['Please show me how X works!', 'How X works'],
  ['Compare A and B', 'Compare A and B'],
  ['   ', 'Untitled canvas'], ['?', 'Untitled canvas'],
])('formats %j as %j', (raw, title) => expect(canvasTitle(raw)).toBe(title))

it('provides visible toolbar labels at 900 px container widths and preserves accessible names', () => {
  render(<CanvasToolbar undo={vi.fn()} redo={vi.fn()} canUndo canRedo
    selected={{ id: 'a', data: {} }} onEdit={vi.fn()} onAdd={vi.fn()}
    onDelete={vi.fn()} canDelete onColour={vi.fn()} onLabel={vi.fn()} />)
  for (const name of ['Undo', 'Redo', 'Keyboard shortcuts', 'Source', 'Add node', 'Add note', 'Edit', 'Colour', 'Delete']) {
    const button = screen.getByRole('button', { name, exact: true })
    expect(button.querySelector('.tm-tool-label')).toHaveTextContent(name === 'Keyboard shortcuts' ? 'Shortcuts' : name)
  }
  const css = readFileSync('src/index.css', 'utf8')
  expect(css).toContain('@container (min-width: 900px)')
  expect(css).toContain('.tm-tool-label { display: inline; }')
  expect(css).toContain('.tm-tool-label { display: none;')
  expect(screen.getByRole('toolbar').querySelectorAll('.tm-tool-separator')).toHaveLength(2)
})

it('wraps the complete label in a textarea at least 240 px wide and cancels on Escape', () => {
  const cancel = vi.fn()
  const save = vi.fn()
  const label = 'Serverless interactive SQL engine with a complete label'
  const { container } = render(<NodeEditor data={{ label, onCancelText: cancel, onSaveText: save }} />)
  const field = screen.getByRole('textbox', { name: 'Label' })
  expect(field.tagName).toBe('TEXTAREA')
  expect(field).toHaveValue(label)
  expect(container.querySelector('.tm-editor')).toHaveStyle({ minWidth: '240px' })
  fireEvent.keyDown(field, { key: 'Escape' })
  expect(cancel).toHaveBeenCalledOnce()
  expect(save).not.toHaveBeenCalled()
})

it('fits wider nodes and saves non-multiline labels on Enter', () => {
  const save = vi.fn()
  const { container } = render(<NodeEditor data={{ label: 'Wide node', editorWidth: 360, onCancelText: vi.fn(), onSaveText: save }} />)
  expect(container.querySelector('.tm-editor')).toHaveStyle({ minWidth: '360px' })
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Label' }), { key: 'Enter' })
  expect(save).toHaveBeenCalledWith({ label: 'Wide node' })
})
