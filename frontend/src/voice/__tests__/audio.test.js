import { afterEach, describe, expect, it, vi } from 'vitest'
import { downsamplePCM } from '../pcm-capture-worklet'
import { createPlayer } from '../player'
import { mockAudio } from './audioMocks'

afterEach(() => vi.unstubAllGlobals())
describe('PCM audio', () => {
  it('converts a 48 kHz sine into 16 kHz little-endian Int16 samples', () => {
    const input = Float32Array.from({ length: 1920 }, (_, i) => Math.sin(2 * Math.PI * 1000 * i / 48000))
    const { pcm } = downsamplePCM(input, 48000)
    const view = new DataView(pcm)
    expect(view.byteLength).toBe(1280)
    for (let i = 0; i < 640; i++) {
      const value = input[i * 3]
      expect(view.getInt16(i * 2, true)).toBe(Math.round(value * (value < 0 ? 32768 : 32767)) || 0)
    }
    expect(view.getInt16(8, true)).toBe(32767)
    expect(view.getInt16(24, true)).toBe(-32768)
  })
  it('preserves fractional positions across capture blocks and clips samples', () => {
    const input = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 10))
    const whole = downsamplePCM(input, 44100).pcm
    const first = downsamplePCM(input.slice(0, 128), 44100)
    const consumed = Math.floor(first.position)
    const second = downsamplePCM(input.slice(consumed), 44100, first.position - consumed)
    expect([...new Uint8Array(first.pcm), ...new Uint8Array(second.pcm)]).toEqual([...new Uint8Array(whole)])
    const clipped = new DataView(downsamplePCM(new Float32Array([2, -2, 0]), 16000).pcm)
    expect(clipped.getInt16(0, true)).toBe(32767)
    expect(clipped.getInt16(2, true)).toBe(-32768)
  })
  it('schedules chunks back to back and stops every scheduled source', () => {
    mockAudio()
    const context = new AudioContext()
    const playing = vi.fn()
    const player = createPlayer(context, playing)
    const pcm = new ArrayBuffer(4800)
    new DataView(pcm).setInt16(0, -16384, true)
    player.play(pcm)
    player.play(pcm)
    expect(context.sources[0].start).toHaveBeenCalledWith(1)
    expect(context.sources[1].start).toHaveBeenCalledWith(1.1)
    expect(context.sources[0].buffer.getChannelData(0)[0]).toBe(-0.5)
    player.stop()
    for (const source of context.sources) expect(source.stop).toHaveBeenCalledOnce()
    expect(playing).toHaveBeenLastCalledWith(false)
  })
})
