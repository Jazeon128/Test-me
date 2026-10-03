import { vi } from 'vitest'

export function mockAudio() {
  const contexts = [], sockets = [], nodes = []
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] }
  const media = { getUserMedia: vi.fn().mockResolvedValue(stream) }
  vi.stubGlobal('AudioContext', class {
    constructor() {
      this.currentTime = 1
      this.destination = {}
      this.audioWorklet = { addModule: vi.fn().mockResolvedValue() }
      this.resume = vi.fn().mockResolvedValue()
      this.close = vi.fn().mockResolvedValue()
      this.sources = []
      contexts.push(this)
    }
    createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() } }
    createBuffer(channels, length, rate) {
      const data = new Float32Array(length)
      return { duration: length / rate, getChannelData: () => data }
    }
    createBufferSource() {
      const source = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }
      this.sources.push(source)
      return source
    }
  })
  vi.stubGlobal('AudioWorkletNode', class {
    constructor() { this.port = {}; this.connect = vi.fn(); this.disconnect = vi.fn(); nodes.push(this) }
  })
  vi.stubGlobal('WebSocket', class {
    static OPEN = 1
    constructor(url) { this.url = url; this.readyState = 1; this.send = vi.fn(); this.close = vi.fn(); sockets.push(this) }
    event(event) { this.onmessage({ data: JSON.stringify(event) }) }
    audio(data) { this.onmessage({ data }) }
  })
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: media })
  return { contexts, sockets, nodes, track, stream, media }
}
