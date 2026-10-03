import { voiceURL } from '../services/api'
import { createPlayer } from './player'

export function startVoiceSession({ notebookId, sourceIds, onEvent }) {
  let closed = false
  let socket, stream, capture, playback, node, microphone, player
  const release = () => {
    if (closed) return
    closed = true
    stream?.getTracks().forEach(track => track.stop())
    if (node) { node.port.onmessage = null; node.disconnect() }
    microphone?.disconnect()
    player?.stop()
    for (const context of [capture, playback]) context?.close().catch(() => {})
    socket?.close()
  }
  const fail = error => {
    release()
    onEvent({ type: 'error', detail: error.name === 'NotAllowedError'
      ? 'Microphone access is blocked. Allow it in your browser to use voice.'
      : error.message || 'Voice session could not be completed.' })
  }
  // Create and resume contexts in the button's user gesture.
  const start = async () => {
    try {
      capture = new AudioContext()
      playback = new AudioContext()
      player = createPlayer(playback, playing => {
        if (!closed) onEvent({ type: 'playback', playing })
      })
      await Promise.all([capture.resume(), playback.resume()])
      if (closed) return
      stream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: true, channelCount: 1,
      } })
      if (closed) { stream.getTracks().forEach(track => track.stop()); return }
      await capture.audioWorklet.addModule(new URL('./pcm-capture-worklet.js', import.meta.url))
      if (closed) return
      const url = await voiceURL(notebookId, sourceIds)
      if (closed) return
      socket = new WebSocket(url)
      socket.binaryType = 'arraybuffer'
      node = new AudioWorkletNode(capture, 'pcm-capture')
      microphone = capture.createMediaStreamSource(stream)
      microphone.connect(node)
      node.connect(capture.destination)
      node.port.onmessage = ({ data }) => {
        if (!closed && socket.readyState === WebSocket.OPEN) socket.send(data)
      }
      socket.onmessage = ({ data }) => {
        if (closed) return
        try {
          if (typeof data !== 'string') { player.play(data); return }
          const event = JSON.parse(data)
          if (event.type === 'interrupted') player.stop()
          if (event.type === 'error' || event.type === 'ended') release()
          onEvent(event)
        } catch (error) { fail(error) }
      }
      socket.onerror = () => { if (!closed) fail(new Error('Voice connection failed.')) }
      socket.onclose = () => {
        if (!closed) { release(); onEvent({ type: 'ended', reason: 'disconnected' }) }
      }
    } catch (error) { queueMicrotask(() => { if (!closed) fail(error) }) }
  }
  void start()
  return { stop() {
    try {
      if (!closed && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'stop' }))
    } finally { release() }
  } }
}
