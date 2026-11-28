import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { speakText, stopSpeaking } from './speech'

const passage = 'Use the past simple for completed actions. Try describing something you did yesterday. '.repeat(11).trim()
const audioResponse = () => new Response(new Blob(['fixture clip'], { type: 'audio/mpeg' }))

interface SpeechRequest {
  text: string
  signal: AbortSignal
}

function playbackFixture(t: TestContext, fetchClip: (request: SpeechRequest, index: number) => Response | Promise<Response> = audioResponse) {
  const players: FixtureAudio[] = []
  const listeners = new Map<number, (player: FixtureAudio) => void>()
  const requests: SpeechRequest[] = []
  class FixtureAudio {
    paused = true
    duration = 5
    currentTime = 0
    onplaying?: () => void
    ontimeupdate?: () => void
    onended?: () => void

    async play() {
      this.paused = false
      const index = players.push(this) - 1
      this.onplaying?.()
      listeners.get(index)?.(this)
    }

    pause() { this.paused = true }

    advance(time: number) {
      this.currentTime = time
      this.ontimeupdate?.()
    }

    end() {
      this.paused = true
      this.onended?.()
    }
  }

  const fetchFixture: typeof fetch = async (_url, init) => {
    assert.ok(init?.signal)
    const { text } = JSON.parse(String(init.body)) as { text: string }
    const request = { text, signal: init.signal }
    return fetchClip(request, requests.push(request) - 1)
  }
  const globals = {
    window: {}, Audio: FixtureAudio, cancelAnimationFrame: () => undefined,
    localStorage: { getItem: () => 'test-session' }, fetch: fetchFixture,
  }
  const original = new Map<string, PropertyDescriptor | undefined>()
  for (const [name, value] of Object.entries(globals)) {
    original.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  }
  t.after(() => {
    stopSpeaking()
    for (const [name, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else Reflect.deleteProperty(globalThis, name)
    }
  })
  return {
    players,
    requests,
    playing: (index: number) => players[index] ? Promise.resolve(players[index])
      : new Promise<FixtureAudio>((resolve) => listeners.set(index, resolve)),
  }
}

test('long speech loads only the next clip near the end and plays it in order', { timeout: 1_500 }, async (t) => {
  const { players, requests, playing } = playbackFixture(t)
  const ended = new Promise<void>((onEnd) => assert.equal(speakText(passage, 'en', { onEnd }), true))
  const first = await playing(0)
  first.advance(1)
  assert.equal(requests.length, 1)
  first.advance(3.5)
  first.advance(4)
  assert.equal(requests.length, 2)
  assert.equal(players.length, 1)
  first.end()
  const second = await playing(1)
  second.advance(4)
  second.end()
  await ended
  assert.equal(requests.length, 2)
  assert.equal(requests.map(({ text }) => text).join(' '), passage)
})

test('stopping speech aborts the prefetched clip without playing it', { timeout: 1_500 }, async (t) => {
  const { players, requests, playing } = playbackFixture(t, ({ signal }, index) => index === 1
    ? new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
    : audioResponse())
  let stopped = 0
  assert.equal(speakText(passage, 'en', { onStop: () => { stopped++ }, onEnd: () => assert.fail('Speech was stopped') }), true)
  const first = await playing(0)
  first.advance(4)
  assert.equal(requests.length, 2)
  stopSpeaking()
  assert.equal(requests[1].signal.aborted, true)
  assert.equal(stopped, 1)
  assert.equal(players.length, 1)
})

test('a failed prefetch defers to the regular synthesis retry at the clip boundary', { timeout: 1_500 }, async (t) => {
  const { requests, playing } = playbackFixture(t, (_request, index) => index === 1 || index === 2
    ? new Response(null, { status: 503 }) : audioResponse())
  const ended = new Promise<void>((onEnd) => assert.equal(speakText(passage, 'en', { onEnd }), true))
  const first = await playing(0)
  first.advance(4)
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.equal(requests.length, 2)
  first.end()
  const second = await playing(1)
  second.end()
  await ended
  assert.equal(requests.length, 4)
  assert.ok(requests.slice(1).every(({ text }) => text === requests[1].text))
})
