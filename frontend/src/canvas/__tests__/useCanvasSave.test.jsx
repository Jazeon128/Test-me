import { act, cleanup, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PropTypes from 'prop-types'
import useCanvasSave from '../useCanvasSave'
import { canvasAPI } from '../../services/api'

vi.mock('../../services/api', () => ({ canvasAPI: { update: vi.fn() } }))
function Wrapper({ children }) {
  return <MemoryRouter>{children}</MemoryRouter>
}
Wrapper.propTypes = { children: PropTypes.node }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
beforeEach(() => {
  vi.useFakeTimers()
  canvasAPI.update.mockReset().mockResolvedValue({ data: {} })
})
afterEach(async () => {
  cleanup()
  await act(async () => {})
  vi.useRealTimers()
})
const setup = () => renderHook(() => useCanvasSave(7), { wrapper: Wrapper })

it('debounces for 800 ms and sends only the latest graph', async () => {
  const { result } = setup()
  act(() => result.current.save({ edited: 'first' }))
  await act(async () => vi.advanceTimersByTime(799))
  expect(canvasAPI.update).not.toHaveBeenCalled()
  act(() => result.current.save({ edited: 'latest' }))
  await act(async () => vi.advanceTimersByTime(800))
  expect(canvasAPI.update).toHaveBeenCalledTimes(1)
  expect(canvasAPI.update).toHaveBeenCalledWith(7, { edited: 'latest' })
  expect(result.current.status).toBe('Saved')
})

it('allows one PATCH in flight and sends latest immediately after completion', async () => {
  const flight = deferred()
  canvasAPI.update.mockReturnValueOnce(flight.promise)
  const { result } = setup()
  act(() => result.current.save({ edited: 'one' }))
  await act(async () => vi.advanceTimersByTime(800))
  act(() => result.current.save({ edited: 'two' }))
  act(() => result.current.save({ edited: 'three' }))
  await act(async () => vi.advanceTimersByTime(800))
  expect(canvasAPI.update).toHaveBeenCalledTimes(1)
  await act(async () => flight.resolve({ data: {} }))
  expect(canvasAPI.update.mock.calls).toEqual([
    [7, { edited: 'one' }],
    [7, { edited: 'three' }],
  ])
  expect(result.current.status).toBe('Saved')
})

it('keeps the latest failed graph for retry', async () => {
  const flight = deferred()
  canvasAPI.update.mockReturnValueOnce(flight.promise)
  const { result } = setup()
  act(() => result.current.save({ edited: 'one' }))
  await act(async () => vi.advanceTimersByTime(800))
  act(() => result.current.save({ edited: 'two' }))
  await act(async () => flight.reject(new Error('Offline')))
  expect(result.current.status).toBe('Save failed')
  await act(async () => result.current.retry())
  expect(canvasAPI.update).toHaveBeenLastCalledWith(7, { edited: 'two' })
  expect(result.current.status).toBe('Saved')
})

it('flushes immediately on navigation unmount and warns before unload while dirty', async () => {
  const flight = deferred()
  canvasAPI.update.mockReturnValueOnce(flight.promise)
  const { result, unmount } = setup()
  act(() => result.current.save({ edited: 'pending' }))
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  unmount()
  expect(canvasAPI.update).toHaveBeenCalledTimes(1)
  expect(canvasAPI.update).toHaveBeenCalledWith(7, { edited: 'pending' })
  await act(async () => flight.resolve({ data: {} }))
})

it('warns while saving and stops warning once saved', async () => {
  const flight = deferred()
  canvasAPI.update.mockReturnValueOnce(flight.promise)
  const { result } = setup()
  act(() => result.current.save({ edited: 'pending' }))
  await act(async () => vi.advanceTimersByTime(800))
  const saving = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(saving)
  expect(saving.defaultPrevented).toBe(true)
  await act(async () => flight.resolve({ data: {} }))
  const saved = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(saved)
  expect(saved.defaultPrevented).toBe(false)
})

it('serializes restore behind a save and discards the pending edit', async () => {
  const flight = deferred()
  canvasAPI.update.mockReturnValueOnce(flight.promise)
  const { result } = setup()
  act(() => result.current.save({ edited: 'one' }))
  await act(async () => vi.advanceTimersByTime(800))
  act(() => result.current.save({ edited: 'two' }))
  act(() => result.current.save({ edited: null, layout: null }))
  let flushed
  act(() => {
    flushed = result.current.flush()
  })
  expect(canvasAPI.update).toHaveBeenCalledTimes(1)
  await act(async () => {
    flight.resolve({ data: {} })
    await flushed
  })
  expect(canvasAPI.update.mock.calls).toEqual([
    [7, { edited: 'one' }],
    [7, { edited: null, layout: null }],
  ])
  await act(async () => vi.advanceTimersByTime(800))
  expect(canvasAPI.update).toHaveBeenCalledTimes(2)
})
