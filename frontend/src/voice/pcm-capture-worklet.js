/* global sampleRate */

// Keep a fractional position between blocks so resampling also works at 44.1 kHz.
export function downsamplePCM(samples, rate, position = 0) {
  const values = []
  const step = rate / 16000
  while (position < samples.length - 1) {
    const index = Math.floor(position)
    const fraction = position - index
    const value = Math.max(-1, Math.min(1, samples[index] * (1 - fraction) + samples[index + 1] * fraction))
    values.push(Math.round(value * (value < 0 ? 32768 : 32767)))
    position += step
  }
  const pcm = new ArrayBuffer(values.length * 2)
  const view = new DataView(pcm)
  values.forEach((value, index) => view.setInt16(index * 2, value, true))
  return { pcm, position }
}

if (typeof registerProcessor !== 'undefined') {
  class PCMCaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super()
      this.pending = new Float32Array(0)
      this.position = 0
      this.chunk = new Uint8Array(1280)
      this.offset = 0
    }

    process(inputs) {
      const channels = inputs[0]
      if (!channels?.length) return true
      const mono = new Float32Array(this.pending.length + channels[0].length)
      mono.set(this.pending)
      for (let i = 0; i < channels[0].length; i++) {
        mono[this.pending.length + i] = channels.reduce((sum, channel) => sum + channel[i], 0) / channels.length
      }
      const { pcm, position } = downsamplePCM(mono, sampleRate, this.position)
      const consumed = Math.min(Math.floor(position), mono.length - 1)
      this.pending = mono.slice(consumed)
      this.position = position - consumed
      for (const byte of new Uint8Array(pcm)) {
        this.chunk[this.offset++] = byte
        if (this.offset === this.chunk.length) {
          this.port.postMessage(this.chunk.buffer, [this.chunk.buffer])
          this.chunk = new Uint8Array(1280)
          this.offset = 0
        }
      }
      return true
    }
  }
  registerProcessor('pcm-capture', PCMCaptureProcessor)
}
