import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SPEECH_LANG,
  createDictation,
  describeSpeechError,
  type DictationHandlers,
} from './dictation'

class FakeRecognition {
  lang = ''
  continuous = false
  interimResults = false
  maxAlternatives = 0
  startCalls = 0
  stopCalls = 0
  abortCalls = 0
  onresult: ((event: unknown) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  onstart: (() => void) | null = null

  start() { this.startCalls += 1 }
  stop() { this.stopCalls += 1 }
  abort() { this.abortCalls += 1 }

  emitResult(index: number, results: Array<{ isFinal: boolean; transcript: string }>) {
    const shaped = results.map((result) => ({ isFinal: result.isFinal, 0: { transcript: result.transcript } }))
    this.onresult?.({ resultIndex: index, results: shaped })
  }
  emitError(error: string) { this.onerror?.({ error }) }
  emitEnd() { this.onend?.() }
}

const globalWithWindow = globalThis as unknown as { window?: unknown }
let originalWindow: unknown

function installWindow(ctor: unknown) {
  originalWindow = globalWithWindow.window
  globalWithWindow.window = ctor ? { SpeechRecognition: ctor } : {}
}
function restoreWindow() {
  globalWithWindow.window = originalWindow
}

function handlers() {
  const calls: Array<[string, ...unknown[]]> = []
  const h: DictationHandlers = {
    onTranscript: (text, isFinal) => calls.push(['transcript', text, isFinal]),
    onError: (kind) => calls.push(['error', kind]),
    onEnd: () => calls.push(['end']),
  }
  return { h, calls }
}

test('speech error codes map to one clear learner-facing reason', () => {
  assert.equal(describeSpeechError('not-allowed'), 'denied')
  assert.equal(describeSpeechError('service-not-allowed'), 'denied')
  assert.equal(describeSpeechError('no-speech'), 'no-speech')
  assert.equal(describeSpeechError('aborted'), 'no-speech')
  assert.equal(describeSpeechError('language-not-supported'), 'unsupported')
  assert.equal(describeSpeechError('network'), 'network')
  assert.equal(describeSpeechError('audio-capture'), 'other')
})

test('a browser without the Web Speech API is reported, never faked', () => {
  installWindow(null)
  try {
    const { h, calls } = handlers()
    const dictation = createDictation(h)
    assert.equal(dictation.supported, false)
    dictation.start()
    dictation.stop()
    dictation.cancel()
    assert.deepEqual(calls, [['error', 'unsupported']])
  } finally {
    restoreWindow()
  }
})

test('webkitSpeechRecognition is used when the standard constructor is missing', () => {
  originalWindow = globalWithWindow.window
  globalWithWindow.window = { webkitSpeechRecognition: FakeRecognition }
  try {
    const { h } = handlers()
    assert.equal(createDictation(h).supported, true)
  } finally {
    restoreWindow()
  }
})

test('the recognizer is configured for Vietnamese continuous interim dictation', () => {
  installWindow(FakeRecognition)
  try {
    // Inspect the constructed instance through a capture subclass.
    const seen: FakeRecognition[] = []
    class Capture extends FakeRecognition { constructor() { super(); seen.push(this) } }
    globalWithWindow.window = { SpeechRecognition: Capture }
    createDictation(handlers().h, 'en-US')
    assert.equal(seen.length, 1)
    assert.equal(seen[0].lang, 'en-US')
    assert.equal(seen[0].continuous, false)
    assert.equal(seen[0].interimResults, true)
    assert.equal(seen[0].maxAlternatives, 1)
  } finally {
    restoreWindow()
  }
})

test('default language is Vietnamese', () => {
  assert.equal(SPEECH_LANG, 'vi-VN')
})

test('a partial update keeps earlier words and waits for the complete final phrase', () => {
  installWindow(FakeRecognition)
  try {
    const captured: FakeRecognition[] = []
    class Capture extends FakeRecognition { constructor() { super(); captured.push(this) } }
    globalWithWindow.window = { SpeechRecognition: Capture }
    const { h, calls } = handlers()
    const dictation = createDictation(h)
    dictation.start()

    captured[0].emitResult(0, [
      { isFinal: true, transcript: ' hôm nay ' },
      { isFinal: false, transcript: 'học gì' },
    ])
    captured[0].emitResult(1, [
      { isFinal: true, transcript: ' hôm nay ' },
      { isFinal: true, transcript: 'học bài nào' },
    ])
    assert.deepEqual(calls, [
      ['transcript', 'hôm nay học gì', false],
      ['transcript', 'hôm nay học bài nào', true],
    ])
  } finally {
    restoreWindow()
  }
})

test('interim results are reported as not final', () => {
  installWindow(FakeRecognition)
  try {
    const captured: FakeRecognition[] = []
    class Capture extends FakeRecognition { constructor() { super(); captured.push(this) } }
    globalWithWindow.window = { SpeechRecognition: Capture }
    const { h, calls } = handlers()
    createDictation(h).start()
    captured[0].emitResult(0, [{ isFinal: false, transcript: 'đang nói' }])
    assert.deepEqual(calls, [['transcript', 'đang nói', false]])
  } finally {
    restoreWindow()
  }
})

test('recognizer errors are mapped before reaching the handler', () => {
  installWindow(FakeRecognition)
  try {
    const captured: FakeRecognition[] = []
    class Capture extends FakeRecognition { constructor() { super(); captured.push(this) } }
    globalWithWindow.window = { SpeechRecognition: Capture }
    const { h, calls } = handlers()
    createDictation(h).start()
    captured[0].emitError('not-allowed')
    assert.deepEqual(calls, [['error', 'denied']])
  } finally {
    restoreWindow()
  }
})

test('a speech-service outage is reported as a network error, not as silence', () => {
  installWindow(FakeRecognition)
  try {
    const captured: FakeRecognition[] = []
    class Capture extends FakeRecognition { constructor() { super(); captured.push(this) } }
    globalWithWindow.window = { SpeechRecognition: Capture }
    const { h, calls } = handlers()
    createDictation(h).start()
    captured[0].emitError('network')
    assert.deepEqual(calls, [['error', 'network']])
  } finally {
    restoreWindow()
  }
})

test('stopping can flush one final transcript, while cancelling discards late events', () => {
  installWindow(FakeRecognition)
  try {
    const captured: FakeRecognition[] = []
    class Capture extends FakeRecognition { constructor() { super(); captured.push(this) } }
    globalWithWindow.window = { SpeechRecognition: Capture }
    const natural = handlers()
    createDictation(natural.h).start()
    captured[0].emitEnd()
    assert.deepEqual(natural.calls, [['end']])

    const stopped = handlers()
    const stopDictation = createDictation(stopped.h)
    stopDictation.start()
    stopDictation.stop()
    const stoppingEngine = captured[captured.length - 1]
    stoppingEngine.emitResult(0, [{ isFinal: true, transcript: 'mở bảng xếp hạng' }])
    stoppingEngine.emitResult(0, [{ isFinal: true, transcript: 'mở bảng xếp hạng' }])
    stoppingEngine.emitEnd()
    assert.deepEqual(stopped.calls, [['transcript', 'mở bảng xếp hạng', true], ['end']])

    const cancelled = handlers()
    const cancelDictation = createDictation(cancelled.h)
    cancelDictation.start()
    cancelDictation.cancel()
    captured[captured.length - 1].emitResult(0, [{ isFinal: true, transcript: 'bỏ câu này' }])
    captured[captured.length - 1].emitEnd()
    assert.deepEqual(cancelled.calls, [])
  } finally {
    restoreWindow()
  }
})

test('an intentional cancel swallows the engine aborted error', () => {
  installWindow(FakeRecognition)
  try {
    const captured: FakeRecognition[] = []
    class Capture extends FakeRecognition { constructor() { super(); captured.push(this) } }
    globalWithWindow.window = { SpeechRecognition: Capture }
    const { h, calls } = handlers()
    const dictation = createDictation(h)
    dictation.start()
    dictation.cancel()
    captured[0].emitError('aborted')
    assert.deepEqual(calls, [])
  } finally {
    restoreWindow()
  }
})

test('start, stop and cancel always reach the engine', () => {
  installWindow(FakeRecognition)
  try {
    const captured: FakeRecognition[] = []
    class Capture extends FakeRecognition { constructor() { super(); captured.push(this) } }
    globalWithWindow.window = { SpeechRecognition: Capture }
    const dictation = createDictation(handlers().h)
    dictation.start()
    dictation.stop()
    dictation.cancel()
    assert.equal(captured[0].startCalls, 1)
    assert.equal(captured[0].stopCalls, 1)
    assert.equal(captured[0].abortCalls, 1)
  } finally {
    restoreWindow()
  }
})
