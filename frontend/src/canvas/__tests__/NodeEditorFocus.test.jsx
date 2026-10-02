import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import NodeEditor from '../NodeEditor'

let frames
let nextFrame
beforeEach(() => {
  vi.useFakeTimers()
  frames = new Map()
  nextFrame = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => frames.delete(id))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})
function DelayedEditor({ note, save }) {
  const [requested, setRequested] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (!requested) return
    const timer = setTimeout(() => setMounted(true), 40)
    return () => clearTimeout(timer)
  }, [requested])
  return <>
    <button type="button" onClick={() => setRequested(true)}>{note ? 'Add note' : 'Add node'}</button>
    {mounted && <NodeEditor note={note} data={{
      label: note ? 'Note' : 'New node', onSaveText: save, onCancelText: () => {},
    }} />}
  </>
}
DelayedEditor.propTypes = { note: PropTypes.bool.isRequired, save: PropTypes.func.isRequired }
it.each([false, true])('focuses and selects a delayed editor on the next frame, note is %s', note => {
  const save = vi.fn()
  render(<DelayedEditor note={note} save={save} />)
  const add = screen.getByRole('button', { name: note ? 'Add note' : 'Add node' })
  add.focus()
  fireEvent.click(add)
  expect(screen.queryByLabelText(note ? 'Text' : 'Label')).not.toBeInTheDocument()
  act(() => vi.advanceTimersByTime(39))
  expect(add).toHaveFocus()
  act(() => vi.advanceTimersByTime(1))
  const field = screen.getByLabelText(note ? 'Text' : 'Label')
  const focus = vi.spyOn(field, 'focus')
  // Browser click focus and React Flow measurement can finish after this mount.
  add.focus()
  expect(field).not.toHaveFocus()
  expect(frames.size).toBe(1)
  act(() => {
    for (const callback of frames.values()) callback(56)
    frames.clear()
  })
  expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  expect(field).toHaveFocus()
  expect(field.selectionStart).toBe(0)
  expect(field.selectionEnd).toBe(note ? 4 : 8)
  fireEvent.change(field, { target: { value: 'Undo test node' } })
  fireEvent.keyDown(field, { key: 'Enter', ctrlKey: note })
  expect(save).toHaveBeenCalledTimes(1)
  expect(save).toHaveBeenCalledWith({ label: 'Undo test node' })
})
it('cancels the pending focus frame when the editor unmounts', () => {
  const { unmount } = render(<NodeEditor data={{
    label: 'New node', onSaveText: vi.fn(), onCancelText: vi.fn(),
  }} />)
  const id = nextFrame
  expect(frames.has(id)).toBe(true)
  unmount()
  expect(window.cancelAnimationFrame).toHaveBeenCalledWith(id)
  expect(frames.has(id)).toBe(false)
})


function runFrame() {
  const pending = [...frames.values()]
  frames.clear()
  act(() => { for (const callback of pending) callback(nextFrame * 16) })
}
function mountEditor(note = false) {
  const view = render(<NodeEditor note={note} data={{
    label: note ? 'Note' : 'New node', onSaveText: vi.fn(), onCancelText: vi.fn(),
  }} />)
  return { ...view, field: screen.getByLabelText(note ? 'Text' : 'Label') }
}
it.each([false, true])('retries through 3 hidden frames and selects the visible field, note is %s', note => {
  const { field } = mountEditor(note)
  const nativeFocus = field.focus.bind(field)
  let attempts = 0
  const focus = vi.spyOn(field, 'focus').mockImplementation(options => {
    attempts++
    if (attempts > 3) nativeFocus(options)
  })
  const select = vi.spyOn(field, 'select')
  for (let i = 0; i < 3; i++) {
    runFrame()
    expect(field).not.toHaveFocus()
    expect(frames.size).toBe(1)
    expect(select).not.toHaveBeenCalled()
  }
  runFrame()
  expect(focus).toHaveBeenCalledTimes(4)
  expect(focus).toHaveBeenLastCalledWith({ preventScroll: true })
  expect(field).toHaveFocus()
  expect([field.selectionStart, field.selectionEnd]).toEqual([0, note ? 4 : 8])
  expect(frames.size).toBe(0)
  runFrame()
  expect(focus).toHaveBeenCalledTimes(4)
})
it.each([false, true])('stops after exactly 30 unsuccessful frames, note is %s', note => {
  const { field } = mountEditor(note)
  const focus = vi.spyOn(field, 'focus').mockImplementation(() => {})
  for (let i = 0; i < 30; i++) runFrame()
  expect(focus).toHaveBeenCalledTimes(30)
  expect(field).not.toHaveFocus()
  expect(frames.size).toBe(0)
  runFrame()
  expect(focus).toHaveBeenCalledTimes(30)
})
it.each(['input', 'textarea', 'contenteditable'])('stops retrying when another %s receives focus', type => {
  const { field } = mountEditor()
  const focus = vi.spyOn(field, 'focus').mockImplementation(() => {})
  runFrame()
  expect(focus).toHaveBeenCalledTimes(1)
  expect(frames.size).toBe(1)
  const other = document.createElement(type === 'contenteditable' ? 'div' : type)
  if (type === 'contenteditable') {
    other.setAttribute('contenteditable', 'true')
    other.tabIndex = 0
  }
  document.body.append(other)
  try {
    other.focus()
    expect(other).toHaveFocus()
    runFrame()
    expect(other).toHaveFocus()
    expect(focus).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
    other.blur()
    runFrame()
    expect(focus).toHaveBeenCalledTimes(1)
  } finally {
    other.remove()
  }
})
it('cancels the latest retry frame on unmount', () => {
  const { field, unmount } = mountEditor()
  vi.spyOn(field, 'focus').mockImplementation(() => {})
  runFrame()
  const retry = nextFrame
  expect(frames.has(retry)).toBe(true)
  unmount()
  expect(window.cancelAnimationFrame).toHaveBeenCalledWith(retry)
  expect(frames.size).toBe(0)
})
