import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const [fixture, duration = '3250', count = '1'] = process.argv.slice(2)
assert.ok(fixture && isAbsolute(fixture), 'Pass the absolute path of a mono PCM WAV fixture')
assert.ok(Number(duration) > 0 && Number.isFinite(Number(duration)), 'Set a positive recording duration in ms')
assert.ok(Number(count) > 0 && Number.isInteger(Number(count)), 'Set a positive number of paired runs')
await access(fixture)
const app = process.env.BUDDY_BENCH_URL ?? 'http://127.0.0.1:5196'
const expected = new RegExp(process.env.BUDDY_BENCH_TRANSCRIPT ?? 'good morning[.!?, ]+how are you today', 'iu')
const expectedReply = new RegExp(process.env.BUDDY_BENCH_REPLY ?? 'good morning', 'iu')
const email = process.env.BUDDY_BENCH_EMAIL
const password = process.env.BUDDY_BENCH_PASSWORD
assert.ok(email && password, 'Set BUDDY_BENCH_EMAIL and BUDDY_BENCH_PASSWORD for a dedicated test account')
const login = await fetch(new URL('/api/auth/login', app), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
const { data: auth } = await login.json()
assert.ok(login.ok && auth?.token && auth.user, 'Sign in with a dedicated benchmark account')
const { data: speech } = await (await fetch(new URL('/api/speech/status', app))).json()
assert.ok(speech?.backend && speech.buddyStreaming, 'Enable both speech modes for this comparison')

const profile = await mkdtemp(join(tmpdir(), 'engorace-stt-chrome-'))
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=0', '--disable-gpu', '--no-first-run',
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  '--autoplay-policy=no-user-gesture-required',
  '--use-file-for-fake-audio-capture=' + fixture,
  '--user-data-dir=' + profile,
], { stdio: 'ignore', windowsHide: true })

async function until(read, label, timeout = 10_000) {
  const end = performance.now() + timeout
  do {
    const found = await read()
    if (found) return found
    await delay(70)
  } while (performance.now() < end)
  throw new Error('Timed out waiting for ' + label)
}

function configure(origin, auth, recordedOnly) {
  if (location.origin !== origin || window !== window.top) return
  localStorage.setItem('engorace_lang', 'en')
  localStorage.setItem('englearn_token', auth.token)
  localStorage.setItem('englearn_user', JSON.stringify(auth.user))
  const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
  navigator.mediaDevices.getUserMedia = async (options) => {
    const stream = await getUserMedia(options)
    performance.mark('bench.mic')
    return stream
  }
  const nativeFetch = window.fetch.bind(window)
  window.fetch = async (input, ...args) => {
    const response = await nativeFetch(input, ...args)
    const path = new URL(typeof input === 'string' ? input : input.url ?? input, location.href).pathname
    if (path === '/api/speech/status' && response.ok) {
      const status = await response.json()
      if (recordedOnly) status.data.buddyStreaming = false
      return Response.json(status)
    }
    if (path === '/api/buddy/voice/session' && response.ok) performance.mark('bench.token')
    return response
  }
}

function snapshot() {
  return {
    measures: performance.getEntriesByType('measure')
      .filter(({ name }) => name.startsWith('buddy.'))
      .map(({ name, duration, detail }) => ({ name, duration, detail })),
    fallback: performance.getEntriesByName('buddy.streaming-fallback').map(({ detail }) => detail?.reason),
    transcript: document.querySelector('.voice-chat-bubble.is-user')?.textContent,
    reply: [...document.querySelectorAll('.voice-chat-bubble.is-agent')].at(-1)?.textContent,
    error: document.querySelector('.buddy-inline-error')?.textContent,
  }
}

let socket
try {
  const port = await until(async () => +(await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')).split('\n')[0], 'Chrome')
  const [target] = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await once(socket, 'open')
  const pending = new Map()
  const voiceSockets = new Set()
  let track = []
  let id = 0
  socket.addEventListener('message', ({ data }) => {
    const { id, result, error, method, params } = JSON.parse(data)
    if (id) {
      const callback = pending.get(id)
      pending.delete(id)
      callback?.(error, result)
    }
    if (method === 'Network.webSocketCreated' && params.url.startsWith('wss://streaming.assemblyai.com/')) {
      voiceSockets.add(params.requestId)
    }
    if (method === 'Network.webSocketFrameReceived' && voiceSockets.has(params.requestId) && params.response.opcode === 1) {
      const data = JSON.parse(params.response.payloadData)
      if (data.type === 'Turn' && !data.end_of_turn) return
      track.push([data.type, data.turn_order, data.turn_is_formatted, data.transcript, params.timestamp])
    }
    if (method === 'Network.webSocketFrameSent' && voiceSockets.has(params.requestId) && params.response.opcode === 1) {
      track.push(['SentTerminate', null, null, null, params.timestamp])
    }
  })
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, (error, result) => error ? reject(new Error(error.message)) : resolve(result))
    socket.send(JSON.stringify({ id, method, params }))
  })
  const value = async (expression) => {
    const data = await call('Runtime.evaluate', { expression, returnByValue: true })
    if (data.exceptionDetails) throw new Error(data.exceptionDetails.exception?.description ?? data.exceptionDetails.text)
    return data.result.value
  }
  await call('Page.enable')
  await call('Network.enable')
  await call('Emulation.setDeviceMetricsOverride', { width: 1360, height: 820, mobile: false, deviceScaleFactor: 1 })
  const click = async () => {
    const { x, y, width, height } = await value("document.querySelector('.voice-orb').getBoundingClientRect().toJSON()")
    const pointer = { x: x + width / 2, y: y + height / 2, button: 'left', clickCount: 1 }
    await call('Input.dispatchMouseEvent', { ...pointer, type: 'mousePressed', buttons: 1 })
    await call('Input.dispatchMouseEvent', { ...pointer, type: 'mouseReleased' })
  }
  const runs = []
  for (let pair = 0; pair < Number(count); pair++) {
    const modes = pair % 2 ? ['recorded', 'streaming'] : ['streaming', 'recorded']
    for (const mode of modes) {
      track = []
      voiceSockets.clear()
      const script = await call('Page.addScriptToEvaluateOnNewDocument', {
        source: '(' + configure + ')(...' + JSON.stringify([new URL(app).origin, auth, mode === 'recorded']) + ')',
      })
      const query = '?bench=' + pair + '-' + mode
      await call('Page.navigate', { url: new URL('/study' + query, app).href })
      await until(() => value(
        'location.search === ' + JSON.stringify(query) + " && Boolean(document.querySelector('.voice-orb[aria-keyshortcuts=Space]'))",
      ), 'voice control')
      if (mode === 'streaming') {
        await until(() => value("performance.getEntriesByName('bench.token').length"), 'temporary streaming token')
      }
      await click()
      await until(() => value("performance.getEntriesByName('bench.mic').length"), 'fixture microphone')
      const remaining = await value("Math.max(0, " + Number(duration) + " + performance.getEntriesByName('bench.mic')[0].startTime - performance.now())")
      await delay(remaining)
      await click()
      const ready = await until(() => value("performance.getEntriesByName('buddy.audio-ready').length || document.querySelector('.buddy-inline-error')?.textContent"), 'speech playback', 25_000).catch(() => null)
      const { measures, fallback, transcript, reply, error } = await value('(' + snapshot + ')()')
      const terminated = track.find((event) => event[0] === 'SentTerminate')?.at(-1) ?? track[0]?.at(-1)
      const transport = track.map(([type, order, formatted, text, timestamp]) =>
        [type, order, formatted, text, Math.round((timestamp - terminated) * 1000)])
      const result = {
        pair: pair + 1, mode, actual: measures[0]?.detail?.path ?? null,
        ok: expected.test(transcript ?? '') && expectedReply.test(reply ?? '') && Number.isFinite(ready),
        transcript, reply, error, fallback,
        ms: Object.fromEntries(measures.map(({ name, duration }) => [name.replace('buddy.', ''), Math.round(duration)])),
        transport,
      }
      runs.push(result)
      console.log(JSON.stringify(result))
      await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: script.identifier })
    }
  }
  for (const mode of ['streaming', 'recorded']) {
    const samples = runs.filter((run) => run.mode === mode)
    const timing = {}
    for (const stage of ['transcript-ready', 'text-first', 'text-ready', 'audio-ready', 'answer-api']) {
      const values = samples.filter((run) => run.ok && run.actual === mode)
        .map(({ ms }) => ms[stage]).filter(Number.isFinite).sort((a, b) => a - b)
      if (values.length) timing[stage] = { p50: values[Math.ceil(values.length * 0.5) - 1], p95: values[Math.ceil(values.length * 0.95) - 1] }
    }
    console.log(JSON.stringify({
      mode, samples: samples.length, successes: samples.filter(({ ok }) => ok).length,
      fallbacks: samples.filter(({ actual }) => actual === 'recorded-fallback').length, timing,
    }))
  }
  process.exitCode = runs.every(({ ok }) => ok) ? 0 : 1
} finally {
  socket?.close()
  const closed = chrome.exitCode === null ? once(chrome, 'exit') : Promise.resolve()
  chrome.kill()
  await Promise.race([closed, delay(2_000, undefined, { ref: false })])
  await rm(profile, { recursive: true, force: true, maxRetries: 12, retryDelay: 150 })
}
