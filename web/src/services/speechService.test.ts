import assert from 'node:assert/strict'
import test from 'node:test'
import { getSpeechStatusApi, practiceSpeechApi, synthesizeSpeechApi, transcribeAudioApi } from './speechService'
import { speakText } from '../utils/speech'

const g = globalThis as unknown as { fetch?: typeof fetch; localStorage?: unknown }
const originalFetch = g.fetch
const originalStorage = g.localStorage

function installStorage(token: string | null) {
  const store = new Map<string, string>()
  if (token) store.set('englearn_token', token)
  Object.defineProperty(g, 'localStorage', {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    },
    configurable: true,
    writable: true,
  })
}

function restore() {
  g.fetch = originalFetch
  Object.defineProperty(g, 'localStorage', { value: originalStorage, configurable: true, writable: true })
}

test('playback retries Edge TTS and ends without using the browser voice after an outage', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const originalCancel = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame')
  let browserVoiceCalls = 0
  let requests = 0
  installStorage('token')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { speechSynthesis: { speak: () => { browserVoiceCalls += 1 }, cancel: () => {} } },
  })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: () => {} })
  g.fetch = (async () => {
    requests += 1
    return new Response(null, { status: 503 })
  }) as typeof fetch
  try {
    await new Promise<void>((onEnd) => {
      assert.equal(speakText('Xin chào', 'vi', { onEnd }), true)
    })
    assert.equal(requests, 2)
    assert.equal(browserVoiceCalls, 0)
  } finally {
    restore()
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
    if (originalCancel) Object.defineProperty(globalThis, 'cancelAnimationFrame', originalCancel)
    else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
  }
})

test('the status probe reports which transcription provider is configured', async () => {
  installStorage('token')
  g.fetch = (async () => Response.json({
    success: true,
    data: { backend: true, maxBytes: 4194304 },
  })) as typeof fetch
  try {
    assert.deepEqual(await getSpeechStatusApi(), {
      backend: true, maxBytes: 4194304,
    })
  } finally {
    restore()
  }
})

test('a broken status probe degrades to "no backend" instead of throwing', async () => {
  installStorage('token')
  g.fetch = (async () => new Response('nope', { status: 500 })) as typeof fetch
  try {
    assert.deepEqual(await getSpeechStatusApi(), {
      backend: false, maxBytes: 0,
    })
  } finally {
    restore()
  }
})

test('audio is posted raw with its own content type and the bearer token', async () => {
  installStorage('demo-token')
  let seenUrl = ''
  let seenInit: RequestInit | undefined
  g.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seenUrl = String(input)
    seenInit = init
    return Response.json({
      success: true,
      data: { text: 'mở bảng xếp hạng', language: 'vi', provider: 'assemblyai', model: 'assemblyai-stt-3-7' },
    })
  }) as typeof fetch
  try {
    const blob = new Blob(['audio'], { type: 'audio/webm' })
    const result = await transcribeAudioApi(blob)
    assert.equal(result.text, 'mở bảng xếp hạng')
    assert.equal(result.provider, 'assemblyai')
    assert.equal(result.model, 'assemblyai-stt-3-7')
    assert.equal(seenUrl, '/api/speech/transcribe?lang=vi')
    const headers = seenInit?.headers as Record<string, string>
    assert.equal(headers['Content-Type'], 'audio/webm')
    assert.equal(headers.Authorization, 'Bearer demo-token')
    assert.equal(seenInit?.method, 'POST')
  } finally {
    restore()
  }
})

test('a clip with no speech surfaces the NO_SPEECH code', async () => {
  installStorage('demo-token')
  g.fetch = (async () => Response.json({
    success: false,
    error: 'Không nghe được nội dung.',
    code: 'NO_SPEECH',
  }, { status: 422 })) as typeof fetch
  try {
    await assert.rejects(
      transcribeAudioApi(new Blob(['audio'], { type: 'audio/wav' })),
      (error: Error & { code?: string }) => error.code === 'NO_SPEECH',
    )
  } finally {
    restore()
  }
})

test('a transcription request without a session is refused before any fetch', async () => {
  installStorage(null)
  let called = false
  g.fetch = (async () => { called = true; return Response.json({}) }) as typeof fetch
  try {
    await assert.rejects(transcribeAudioApi(new Blob(['audio'])), /đăng nhập/i)
    assert.equal(called, false)
  } finally {
    restore()
  }
})

test('read-aloud practice preserves the reference and exposes NO_SPEECH for a free retry', async () => {
  installStorage('demo-token')
  const clip = new Blob(['audio'], { type: 'audio/wav' })
  g.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(new URL(String(input), 'http://localhost').searchParams.get('text'), 'How are you?')
    assert.equal(init?.body, clip)
    return Response.json({ success: false, code: 'NO_SPEECH' }, { status: 422 })
  }) as typeof fetch
  try {
    await assert.rejects(practiceSpeechApi('How are you?', clip), { code: 'NO_SPEECH' })
  } finally {
    restore()
  }
})

test('neural playback can retry a temporary outage with the same language and text', async () => {
  installStorage('demo-token')
  const requests: Array<{ path: string; body: unknown }> = []
  g.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ path: String(input), body: JSON.parse(String(init?.body)) })
    if (requests.length === 1) return new Response('Not available', { status: 503 })
    return new Response('mp3', { headers: { 'Content-Type': 'audio/mpeg' } })
  }) as typeof fetch
  try {
    const audio = await synthesizeSpeechApi('Xin chào!', 'vi', undefined, { retryUnavailable: true })
    assert.equal(audio.type, 'audio/mpeg')
    assert.deepEqual(requests, Array.from({ length: 2 }, () => ({
      path: '/api/speech/synthesize',
      body: { text: 'Xin chào!', lang: 'vi' },
    })))
  } finally {
    restore()
  }
})
