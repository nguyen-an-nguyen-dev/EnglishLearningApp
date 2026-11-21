import assert from 'node:assert/strict'
import test from 'node:test'
import { getSpeechStatusApi, transcribeAudioApi } from './speechService'

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

test('the status probe reports which transcription provider is configured', async () => {
  installStorage('token')
  g.fetch = (async () => Response.json({
    success: true,
    data: { backend: true, whisper: true, gemini: false, maxBytes: 4194304 },
  })) as typeof fetch
  try {
    assert.deepEqual(await getSpeechStatusApi(), {
      backend: true, whisper: true, gemini: false, maxBytes: 4194304,
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
      backend: false, whisper: false, gemini: false, maxBytes: 0,
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
      data: { text: 'mở bảng xếp hạng', language: 'vi', provider: 'whisper' },
    })
  }) as typeof fetch
  try {
    const blob = new Blob(['audio'], { type: 'audio/webm' })
    const result = await transcribeAudioApi(blob)
    assert.equal(result.text, 'mở bảng xếp hạng')
    assert.equal(result.provider, 'whisper')
    assert.equal(seenUrl, '/api/speech/transcribe')
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
