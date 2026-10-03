import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ChatPanel from '../ChatPanel'
import ChatMessage from '../ChatMessage'
import { notebooksAPI, voiceURL } from '../../../services/api'
import { mockAudio } from '../../../voice/__tests__/audioMocks'

vi.mock('../../../services/api', () => ({ notebooksAPI: { chatHistory: vi.fn() }, voiceURL: vi.fn() }))
let audio
const props = { notebookId: 7, sourceIds: [1, 2], sources: [] }
beforeEach(() => {
  vi.stubEnv('VITE_DEMO', 'false')
  audio = mockAudio()
  notebooksAPI.chatHistory.mockResolvedValue({ data: [] })
  voiceURL.mockResolvedValue('ws://localhost:5173/api/notebooks/7/voice?source_ids=1,2')
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks() })
async function mount() {
  const rendered = render(<ChatPanel {...props} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Talk' })).toBeEnabled())
  return rendered
}
async function start() {
  fireEvent.click(screen.getByRole('button', { name: 'Talk' }))
  expect(screen.getByRole('status')).toHaveTextContent('Connecting...')
  await waitFor(() => expect(audio.sockets).toHaveLength(1))
  return audio.sockets[0]
}
const event = (socket, data) => act(() => socket.event(data))
const released = () => {
  expect(audio.track.stop).toHaveBeenCalledOnce()
  for (const context of audio.contexts) expect(context.close).toHaveBeenCalledOnce()
}
it('keeps voice in answer mode when Tutor me is selected', async () => {
  await mount()
  fireEvent.click(screen.getByRole('button', { name: 'Tutor me' }))
  const socket = await start()
  expect(voiceURL).toHaveBeenCalledWith(7, [1, 2])
  event(socket, { type: 'turn_saved', messages: [
    { id: 1, role: 'assistant', content: 'Spoken answer', mode: 'voice' },
  ] })
  expect(screen.getByText('AI answer')).toBeInTheDocument()
  expect(screen.getByText('Voice')).toBeInTheDocument()
  expect(screen.queryByText('AI tutor')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Stop talking' }))
})
it('starts with ticked ids, shows fragments, saves 2 and 1 messages, and disables typing and Send', async () => {
  await mount()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Question' } })
  const socket = await start()
  expect(voiceURL).toHaveBeenCalledWith(7, [1, 2])
  expect(audio.media.getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
  expect(screen.getByRole('textbox')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Stop talking' })).toHaveAttribute('aria-pressed', 'true')
  event(socket, { type: 'ready', model: 'test' })
  expect(screen.getByRole('status')).toHaveTextContent('Listening')
  event(socket, { type: 'input_transcript', text: 'What ' })
  event(socket, { type: 'input_transcript', text: 'is quorum?' })
  event(socket, { type: 'output_transcript', text: 'Three ' })
  event(socket, { type: 'output_transcript', text: 'nodes.' })
  const live = screen.getByLabelText('Live voice transcript')
  expect(live).toHaveTextContent('You: What is quorum?')
  expect(live).toHaveTextContent('Assistant: Three nodes.')
  event(socket, { type: 'turn_saved', messages: [
    { id: 1, role: 'user', content: 'What is quorum?', mode: 'voice' },
    { id: 2, role: 'assistant', content: 'Three nodes.', mode: 'voice' },
  ] })
  expect(screen.getAllByRole('article')).toHaveLength(2)
  expect(live).not.toHaveTextContent('Three nodes.')
  event(socket, { type: 'output_transcript', text: 'More detail.' })
  event(socket, { type: 'turn_saved', messages: [{ id: 3, role: 'assistant', content: 'More detail.', mode: 'voice' }] })
  expect(screen.getAllByRole('article')).toHaveLength(3)
  expect(live).not.toHaveTextContent('More detail.')
})
it('shows Speaking until playback completes and stops scheduled audio on interruption', async () => {
  await mount()
  const socket = await start()
  event(socket, { type: 'ready' })
  act(() => socket.audio(new ArrayBuffer(4800)))
  expect(screen.getByRole('status')).toHaveTextContent('Speaking')
  act(() => audio.contexts[1].sources[0].onended())
  expect(screen.getByRole('status')).toHaveTextContent('Listening')
  act(() => socket.audio(new ArrayBuffer(4800)))
  event(socket, { type: 'interrupted' })
  expect(audio.contexts[1].sources[1].stop).toHaveBeenCalledOnce()
  expect(screen.getByRole('status')).toHaveTextContent('Listening')
})
it('sends stop and releases the microphone on Stop talking', async () => {
  await mount()
  const socket = await start()
  audio.nodes[0].port.onmessage({ data: new ArrayBuffer(1280) })
  expect(socket.send).toHaveBeenCalledWith(expect.any(ArrayBuffer))
  fireEvent.click(screen.getByRole('button', { name: 'Stop talking' }))
  expect(socket.send).toHaveBeenLastCalledWith('{"type":"stop"}')
  released()
  expect(socket.close).toHaveBeenCalledOnce()
  expect(screen.getByRole('textbox')).toBeEnabled()
})
it.each(['error', 'close', 'socketError', 'time_limit'])('releases the microphone on %s', async kind => {
  await mount()
  const socket = await start()
  if (kind === 'error') event(socket, { type: 'error', detail: 'Provider failed' })
  if (kind === 'close') act(() => socket.onclose())
  if (kind === 'socketError') act(() => socket.onerror())
  if (kind === 'time_limit') event(socket, { type: 'ended', reason: 'time_limit' })
  released()
  if (kind === 'error') expect(screen.getByRole('alert')).toHaveTextContent('Provider failed')
  if (kind === 'time_limit') expect(screen.getByRole('alert')).toHaveTextContent('Voice session reached its 15 minute limit. Press Talk to continue.')
  expect(screen.getByRole('button', { name: 'Talk' })).toBeEnabled()
})
it.each(['unmount', 'notebook', 'sources'])('releases the microphone on %s change', async kind => {
  const rendered = await mount()
  await start()
  if (kind === 'unmount') rendered.unmount()
  if (kind === 'notebook') await act(async () => rendered.rerender(<ChatPanel {...props} notebookId={8} />))
  if (kind === 'sources') rendered.rerender(<ChatPanel {...props} sourceIds={[2]} />)
  released()
})
it('shows the specified permission denied message', async () => {
  audio.media.getUserMedia.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
  await mount()
  fireEvent.click(screen.getByRole('button', { name: 'Talk' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Microphone access is blocked. Allow it in your browser to use voice.')
  expect(audio.contexts.every(context => context.close.mock.calls.length === 1)).toBe(true)
})
it('releases a microphone obtained after Stop was pressed during permission', async () => {
  let resolve
  audio.media.getUserMedia.mockReturnValue(new Promise(done => { resolve = done }))
  await mount()
  fireEvent.click(screen.getByRole('button', { name: 'Talk' }))
  await waitFor(() => expect(audio.media.getUserMedia).toHaveBeenCalled())
  fireEvent.click(screen.getByRole('button', { name: 'Stop talking' }))
  await act(async () => resolve(audio.stream))
  released()
  expect(audio.sockets).toHaveLength(0)
})
it('hides Talk and shows the demo note once', async () => {
  vi.stubEnv('VITE_DEMO', 'true')
  render(<ChatPanel {...props} />)
  await waitFor(() => expect(screen.queryByText('Loading chat...')).not.toBeInTheDocument())
  expect(screen.queryByRole('button', { name: 'Talk' })).not.toBeInTheDocument()
  expect(screen.getAllByText('Voice mode needs Test Me on your own computer.')).toHaveLength(1)
})
it('renders a voice assistant label and Sources chips while typed rendering stays unchanged', () => {
  const message = { role: 'assistant', content: 'Three nodes.', citations: [{ n: 1, display_name: 'Notes', locator: 'Page 1' }] }
  const rendered = render(<ChatMessage message={{ ...message, mode: 'voice' }} />)
  expect(screen.getByText('Voice')).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Sources' })).getByRole('button', { name: 'Citation 1: Notes, Page 1' })).toBeInTheDocument()
  rendered.rerender(<ChatMessage message={{ ...message, content: 'Three nodes [1].' }} />)
  expect(screen.queryByText('Voice')).not.toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Sources' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Citation 1: Notes, Page 1' })).toBeInTheDocument()
})
