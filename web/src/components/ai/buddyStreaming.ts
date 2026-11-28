import workletSource from './buddyPcm.worklet.js?raw'

const MODEL = 'assemblyai-stt-3-7-realtime'
const SAMPLE_RATE = 16_000
const BYTES_PER_MS = SAMPLE_RATE * 2 / 1_000
const MAX_FRAME_MS = 1_000
const MAX_BUFFER_MS = 4_000
const CONNECT_MS = 4_500
const FINISH_MS = 2_600
const TERMINATE = JSON.stringify({ type: 'Terminate' })

interface BuddyStream {
  attach(stream: MediaStream): void
  finish(): Promise<string | null>
  cancel(): void
}

export interface BuddyVoiceToken {
  token: Promise<string | null>
  request: AbortController
}

export function streamBuddyAudio(session: BuddyVoiceToken, onTranscript: (text: string) => void): BuddyStream | null {
  if (typeof AudioContext === 'undefined' || typeof AudioWorkletNode === 'undefined') return null

  let audio: AudioContext
  try {
    audio = new AudioContext()
  } catch {
    return null
  }
  if (!audio.audioWorklet) {
    void audio.close().catch(() => {})
    return null
  }

  let state: 'connecting' | 'streaming' | 'terminating' | 'closed' = 'connecting'
  let socket: WebSocket | undefined
  let source: MediaStreamAudioSourceNode | undefined
  let capture: AudioWorkletNode | undefined
  let finishTimer: number | undefined
  let sendTimer: number | undefined
  let nextSendAt = 0
  let flushed = false
  let sentBytes = 0
  let queuedBytes = 0
  const frames: ArrayBuffer[] = []
  const turns = new Map<number, { text: string; final: boolean }>()
  let resolveTranscript: (text: string | null) => void
  const transcript = new Promise<string | null>((resolve) => { resolveTranscript = resolve })

  function close(reason: string, text: string | null = null) {
    if (state === 'closed') return
    const terminateOnClose = state !== 'terminating'
    state = 'closed'
    if (text === null && reason !== 'cancelled') {
      performance.mark('buddy.streaming-fallback', { detail: { reason } })
    }
    window.clearTimeout(connectTimer)
    window.clearTimeout(finishTimer)
    window.clearTimeout(sendTimer)
    session.request.abort()
    if (terminateOnClose && socket?.readyState === WebSocket.OPEN) {
      try { socket.send(TERMINATE) } catch { /* The connection is already failing. */ }
    }
    socket?.close()
    source?.disconnect()
    capture?.disconnect()
    capture?.port.close()
    void audio.close().catch(() => {})
    frames.length = 0
    resolveTranscript(text)
  }

  const connectTimer = window.setTimeout(() => close('setup-timeout'), CONNECT_MS)

  function drain() {
    if (state !== 'streaming' || socket?.readyState !== WebSocket.OPEN || sendTimer !== undefined) return
    try {
      if (socket.bufferedAmount > MAX_BUFFER_MS * BYTES_PER_MS) {
        close('network-backlog')
        return
      }
      if (frames.length > 0) {
        const delay = nextSendAt - performance.now()
        if (delay > 1) {
          sendTimer = window.setTimeout(() => {
            sendTimer = undefined
            drain()
          }, Math.ceil(delay))
          return
        }
        const batch = new Uint8Array(Math.min(queuedBytes, MAX_FRAME_MS * BYTES_PER_MS))
        let used = 0
        while (frames[0] && used + frames[0].byteLength <= batch.byteLength) {
          const frame = frames.shift()!
          batch.set(new Uint8Array(frame), used)
          used += frame.byteLength
        }
        socket.send(batch.subarray(0, used))
        queuedBytes -= used
        sentBytes += used
        const backlog = used > 100 * BYTES_PER_MS || queuedBytes > 0
        const pace = backlog ? 1.2 : 1
        nextSendAt = Math.max(nextSendAt, performance.now() - 5) + used / BYTES_PER_MS / pace
        if (frames.length > 0) {
          drain()
          return
        }
      }
      if (flushed) {
        if (sentBytes === 0) { close('no-streamed-audio'); return }
        socket.send(TERMINATE)
        state = 'terminating'
      }
    } catch {
      close('send-error')
    }
  }

  async function connect() {
    const token = await session.token
    if (state === 'closed') return
    if (!token) { close('token-unavailable'); return }
    const url = new URL('wss://streaming.assemblyai.com/v3/ws')
    url.search = new URLSearchParams({
      token, speech_model: MODEL, sample_rate: String(SAMPLE_RATE),
      encoding: 'pcm_s16le', mode: 'min_latency',
    }).toString()
    const connection = new WebSocket(url)
    socket = connection
    connection.onerror = () => close('websocket-error')
    connection.onclose = ({ code }) => close(`websocket-close-${code}`)
    connection.onmessage = ({ data }) => {
      if (state === 'closed' || typeof data !== 'string') return
      try {
        const message = JSON.parse(data)
        switch (message.type) {
          case 'Begin':
            if (state !== 'connecting') return
            if (message.configuration?.model && message.configuration.model !== MODEL) {
              close('unexpected-model')
              return
            }
            state = 'streaming'
            window.clearTimeout(connectTimer)
            drain()
            break
          case 'Turn':
            if (Number.isInteger(message.turn_order)) {
              const text = typeof message.transcript === 'string' ? message.transcript : ''
              const final = message.end_of_turn === true && message.turn_is_formatted === true
                && typeof message.transcript === 'string'
              turns.set(message.turn_order, { text, final })
              if (state === 'streaming' && finishTimer === undefined) {
                const preview = [...turns.entries()].sort(([a], [b]) => a - b)
                  .map(([, turn]) => turn.text).join(' ').trim()
                onTranscript(preview.slice(0, 500))
              }
            }
            break
          case 'Termination': {
            if (state !== 'terminating') { close('unexpected-termination'); return }
            const segments = [...turns.entries()].sort(([a], [b]) => a - b).map(([, turn]) => turn)
            if (segments.some((turn) => !turn.final)) { close('incomplete-transcript'); return }
            const text = segments.map((turn) => turn.text).join(' ').replace(/\s+/gu, ' ').trim()
            close('completed', /[\p{L}\p{N}]/u.test(text) ? text.slice(0, 500) : '')
            break
          }
          case 'Error':
            close('provider-error')
        }
      } catch {
        close('invalid-message')
      }
    }
  }

  const workletUrl = URL.createObjectURL(new Blob([workletSource], { type: 'text/javascript' }))
  const loaded = audio.audioWorklet.addModule(workletUrl).finally(() => URL.revokeObjectURL(workletUrl))
  const worklet = Promise.all([loaded, audio.resume()])
  void worklet.catch(() => close('worklet-load-error'))
  void connect().catch(() => close('session-request-error'))

  return {
    attach(stream) {
      const attachedAt = performance.now()
      void worklet.then(() => {
        if (state === 'closed') return
        if (performance.now() - attachedAt > 180) { close('late-microphone-attach'); return }
        source = audio.createMediaStreamSource(stream)
        capture = new AudioWorkletNode(audio, 'buddy-pcm', { channelCount: 1, channelCountMode: 'explicit' })
        capture.onprocessorerror = () => close('worklet-processing-error')
        capture.port.onmessage = ({ data }: MessageEvent<ArrayBuffer | 'flushed'>) => {
          if (state === 'closed' || flushed) return
          if (data === 'flushed') {
            flushed = true
          } else {
            queuedBytes += data.byteLength
            if (queuedBytes > MAX_BUFFER_MS * BYTES_PER_MS) { close('microphone-backlog'); return }
            frames.push(data)
          }
          drain()
        }
        source.connect(capture).connect(audio.destination)
      }).catch(() => close('microphone-attach-error'))
    },
    finish() {
      if (state === 'closed' || finishTimer !== undefined) return transcript
      if (state === 'connecting') { close('stopped-before-connection'); return transcript }
      if (!capture) { close('stopped-before-ready'); return transcript }
      finishTimer = window.setTimeout(() => close('final-timeout'), FINISH_MS)
      capture.port.postMessage('flush')
      return transcript
    },
    cancel: () => close('cancelled'),
  }
}
