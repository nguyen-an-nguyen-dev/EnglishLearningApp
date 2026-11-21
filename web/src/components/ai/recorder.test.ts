import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_RECORD_MS, createRecorder, type RecorderHandlers } from './recorder'

class FakeTrack {
  stopped = false
  stop() { this.stopped = true }
}

class FakeStream {
  tracks = [new FakeTrack()]
  getTracks() { return this.tracks }
}

class FakeRecorder {
  static supported = ['audio/webm;codecs=opus']
  static instances: FakeRecorder[] = []
  static isTypeSupported(type: string) { return FakeRecorder.supported.includes(type) }

  state: 'inactive' | 'recording' = 'inactive'
  mimeType: string
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onstop: (() => void) | null = null

  constructor(_stream: unknown, options?: { mimeType?: string }) {
    this.mimeType = options?.mimeType ?? ''
    FakeRecorder.instances.push(this)
  }
  start() { this.state = 'recording' }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['audio-bytes'], { type: this.mimeType || 'audio/webm' }) })
    this.onstop?.()
  }
}

type Timer = { callback: () => void; cleared: boolean }
let timers: Timer[] = []
const g: typeof globalThis & { window?: unknown; navigator?: unknown } = globalThis
let originalWindow: unknown
let originalNavigator: unknown

function install(options: {
  getUserMedia?: () => Promise<FakeStream>
  withRecorder?: boolean
  withDevices?: boolean
} = {}) {
  timers = []
  originalWindow = g.window
  originalNavigator = g.navigator
  const mediaDevices = options.withDevices === false ? undefined : {
    getUserMedia: options.getUserMedia ?? (async () => new FakeStream()),
  }
  Object.defineProperty(g, 'navigator', {
    value: mediaDevices ? { mediaDevices } : {},
    configurable: true,
    writable: true,
  })
  Object.defineProperty(g, 'window', {
    value: {
      ...(options.withRecorder === false ? {} : { MediaRecorder: FakeRecorder }),
      setTimeout: (callback: () => void) => {
        const record: Timer = { callback, cleared: false }
        timers.push(record)
        return timers.length - 1
      },
      clearTimeout: (id: number) => { if (timers[id]) timers[id].cleared = true },
    },
    configurable: true,
    writable: true,
  })
}

function restore() {
  Object.defineProperty(g, 'window', { value: originalWindow, configurable: true, writable: true })
  Object.defineProperty(g, 'navigator', { value: originalNavigator, configurable: true, writable: true })
  FakeRecorder.instances = []
}

function handlers() {
  const calls: Array<[string, ...unknown[]]> = []
  const h: RecorderHandlers = {
    onClip: (blob) => calls.push(['clip', blob]),
    onError: (kind) => calls.push(['error', kind]),
  }
  return { h, calls }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

test('a browser without MediaRecorder is reported as unsupported', () => {
  install({ withRecorder: false })
  try {
    const { h, calls } = handlers()
    const recorder = createRecorder(h)
    assert.equal(recorder.supported, false)
    recorder.start()
    recorder.stop()
    recorder.cancel()
    assert.deepEqual(calls, [['error', 'unsupported']])
  } finally {
    restore()
  }
})

test('a browser without getUserMedia is reported as unsupported', () => {
  install({ withDevices: false })
  try {
    assert.equal(createRecorder(handlers().h).supported, false)
  } finally {
    restore()
  }
})

test('start records with the first supported mime type', async () => {
  install()
  try {
    const { h } = handlers()
    const recorder = createRecorder(h)
    assert.equal(recorder.supported, true)
    recorder.start()
    await tick()
    assert.equal(FakeRecorder.instances.length, 1)
    assert.equal(FakeRecorder.instances[0].mimeType, 'audio/webm;codecs=opus')
    assert.equal(FakeRecorder.instances[0].state, 'recording')
  } finally {
    restore()
  }
})

test('stop delivers one clip and releases the microphone', async () => {
  install()
  try {
    const { h, calls } = handlers()
    const recorder = createRecorder(h)
    recorder.start()
    await tick()
    const active = FakeRecorder.instances[0]
    recorder.stop()
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'clip')
    assert.equal(active.state, 'inactive')
  } finally {
    restore()
  }
})

test('cancel releases the microphone without delivering a clip', async () => {
  install()
  try {
    const { h, calls } = handlers()
    const recorder = createRecorder(h)
    recorder.start()
    await tick()
    recorder.cancel()
    assert.deepEqual(calls, [])
  } finally {
    restore()
  }
})

test('a denied microphone is mapped to its own reason', async () => {
  install({
    getUserMedia: async () => { throw new DOMException('denied', 'NotAllowedError') },
  })
  try {
    const { h, calls } = handlers()
    createRecorder(h).start()
    await tick()
    assert.deepEqual(calls, [['error', 'denied']])
  } finally {
    restore()
  }
})

test('a failed capture is reported as a generic error', async () => {
  install({
    getUserMedia: async () => { throw new DOMException('broken', 'NotReadableError') },
  })
  try {
    const { h, calls } = handlers()
    createRecorder(h).start()
    await tick()
    assert.deepEqual(calls, [['error', 'other']])
  } finally {
    restore()
  }
})

test('an empty recording reports empty so the orb can reset quietly', async () => {
  install()
  try {
    const { h, calls } = handlers()
    const recorder = createRecorder(h)
    recorder.start()
    await tick()
    const active = FakeRecorder.instances[0]
    active.ondataavailable = null
    recorder.stop()
    assert.deepEqual(calls, [['error', 'empty']])
  } finally {
    restore()
  }
})

test('stopping before the microphone opens reports empty and never starts late', async () => {
  const gate: { release?: (stream: FakeStream) => void } = {}
  install({ getUserMedia: () => new Promise<FakeStream>((resolve) => { gate.release = resolve }) })
  try {
    const { h, calls } = handlers()
    const recorder = createRecorder(h)
    recorder.start()
    recorder.stop()
    assert.deepEqual(calls, [['error', 'empty']])
    // The permission prompt resolves after the stop: no recording may begin.
    gate.release?.(new FakeStream())
    await tick()
    assert.equal(FakeRecorder.instances.length, 0)
  } finally {
    restore()
  }
})

test('a long utterance is stopped automatically at the 30-second cap', async () => {
  install()
  try {
    const { h, calls } = handlers()
    const recorder = createRecorder(h)
    recorder.start()
    await tick()
    assert.equal(timers.length, 1)
    assert.equal(MAX_RECORD_MS, 30_000)
    timers[0].callback()
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'clip')
  } finally {
    restore()
  }
})

test('a cancelled permission request cannot attach to a newer recording', async () => {
  const requests: Array<(stream: FakeStream) => void> = []
  install({ getUserMedia: () => new Promise<FakeStream>((resolve) => requests.push(resolve)) })
  try {
    const { h, calls } = handlers()
    const recorder = createRecorder(h)
    recorder.start()
    recorder.cancel()
    recorder.start()
    const stale = new FakeStream()
    const current = new FakeStream()
    requests[1](current)
    requests[0](stale)
    await tick()
    assert.equal(stale.tracks[0].stopped, true)
    assert.equal(current.tracks[0].stopped, false)
    assert.equal(FakeRecorder.instances.length, 1)
    recorder.stop()
    assert.deepEqual(calls.map(([event]) => event), ['clip'])
  } finally {
    restore()
  }
})
