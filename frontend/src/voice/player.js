export function createPlayer(context, onPlaying = () => {}) {
  const sources = new Set()
  let nextTime = 0
  return {
    play(pcm) {
      const view = new DataView(pcm)
      const buffer = context.createBuffer(1, Math.floor(view.byteLength / 2), 24000)
      const channel = buffer.getChannelData(0)
      for (let i = 0; i < channel.length; i++) channel[i] = view.getInt16(i * 2, true) / 32768
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      sources.add(source)
      source.onended = () => {
        source.disconnect()
        sources.delete(source)
        if (!sources.size) onPlaying(false)
      }
      const start = Math.max(context.currentTime, nextTime)
      nextTime = start + buffer.duration
      source.start(start)
      onPlaying(true)
    },
    stop() {
      for (const source of sources) {
        source.onended = null
        source.stop()
        source.disconnect()
      }
      sources.clear()
      nextTime = 0
      onPlaying(false)
    },
  }
}
