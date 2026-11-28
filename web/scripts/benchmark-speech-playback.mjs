// Run from web with: node --import tsx scripts/benchmark-speech-playback.mjs
import { speakText, stopSpeaking } from '../src/utils/speech.ts'

const original = new Map()
function replaceGlobal(name, value) {
  original.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
}

const renderMs = 90
const playbackMs = 180
const samples = []
let current
const passage = 'Use the past simple for completed actions. Try describing something you did yesterday. '.repeat(11)

class FixtureAudio {
  currentTime = 0
  duration = 4
  paused = true
  tick
  end

  async play() {
    this.paused = false
    queueMicrotask(() => {
      if (this.paused) return
      current.starts.push(performance.now())
      this.onplaying?.()
    })
    this.tick = setTimeout(() => {
      this.currentTime = 3
      this.ontimeupdate?.()
    }, 50)
    this.end = setTimeout(() => {
      this.currentTime = this.duration
      current.ends.push(performance.now())
      this.paused = true
      this.onended?.()
    }, playbackMs)
  }

  pause() {
    this.paused = true
    clearTimeout(this.tick)
    clearTimeout(this.end)
  }
}

replaceGlobal('window', {})
replaceGlobal('Audio', FixtureAudio)
replaceGlobal('cancelAnimationFrame', () => undefined)
replaceGlobal('localStorage', { getItem: () => 'speech-benchmark' })
replaceGlobal('fetch', async (_url, options) => {
  current.requests++
  const text = JSON.parse(options.body).text
  current.sent.push(text)
  await new Promise((resolve) => setTimeout(resolve, renderMs))
  return new Response(new Blob(['fixture clip'], { type: 'audio/mpeg' }))
})

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b)
  return Math.round(sorted[Math.ceil(sorted.length * fraction) - 1] * 10) / 10
}

try {
  for (let index = 0; index < 13; index++) {
    current = { starts: [], ends: [], requests: 0, sent: [] }
    const started = performance.now()
    await new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error('Fixture playback did not finish')), 3_000)
      const onEnd = () => { clearTimeout(deadline); resolve() }
      if (!speakText(passage, 'en', { onEnd })) {
        clearTimeout(deadline)
        reject(new Error('Fixture playback was not accepted'))
      }
    })
    const { starts, ends, sent, requests } = current
    const correct = starts.length === 2 && ends.length === 2 && requests === 2
      && sent.join(' ') === passage.trim()
    if (index > 0) samples.push({ correct, requests, first: starts[0] - started, gap: starts[1] - ends[0] })
  }
  const passed = samples.filter(({ correct }) => correct).length
  console.log(JSON.stringify({
    samples: samples.length, passed, synthesis_requests: samples.reduce((sum, { requests }) => sum + requests, 0),
    first_audio_p50_ms: percentile(samples.map(({ first }) => first), 0.5),
    gap_p50_ms: percentile(samples.map(({ gap }) => gap), 0.5),
    gap_p95_ms: percentile(samples.map(({ gap }) => gap), 0.95),
  }))
  if (passed !== samples.length) process.exitCode = 1
} finally {
  stopSpeaking()
  for (const [name, descriptor] of original) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
}
