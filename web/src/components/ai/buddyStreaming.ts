import workletSource from './buddyPcm.worklet.js?raw'

const SAMPLE_RATE = 16_000
const FRAME_MS = 100
const MAX_CHUNK_BYTES = SAMPLE_RATE * 2
const MAX_BUFFERED_BYTES = MAX_CHUNK_BYTES * 2
const FINAL_TIMEOUT_MS = 1_600

interface BuddyStream {
  attach(stream: MediaStream): void
  finish(): Promise<string | null>
  cancel(): void
}

export interface BuddyVoiceToken {
  token: Promise<string | null>
  request: AbortController
}

/** The caller retains the MediaRecorder clip until a final transcript arrives. */
export function streamBuddyAudio(session: BuddyVoiceToken): BuddyStream | null {
  if (typeof AudioContext === 'undefined' || typeof AudioWorkletNode === 'undefined') return null

  let audio: AudioContext
  try {
    audio = new AudioContext({ sampleRate: SAMPLE_RATE })
  } catch {
    return null
  }

  const queue: ArrayBuffer[] = []
  let queuedBytes = 0
  let socket: WebSocket | undefined
  let node: AudioWorkletNode | undefined
  let source: MediaStreamAudioSourceNode | undefined
  let ready = false
  let flushed = false
  let awaitingFinal = false
  let closed = false
  let resolveResult: (result: string | null) => void
  const result = new Promise<string | null>((resolve) => { resolveResult = resolve })
  let finalTimer: number | undefined
  let sendTimer: number | undefined

  const close = (reason: string, transcript: string | null = null) => {
    if (closed) return
    closed = true
    if (!transcript && reason !== 'cancelled') {
      performance.mark('buddy.streaming-fallback', { detail: { reason } })
    }
    window.clearTimeout(finalTimer)
    window.clearTimeout(setupTimer)
    window.clearTimeout(sendTimer)
    session.request.abort()
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'Terminate' }))
    socket?.close()
    source?.disconnect()
    node?.disconnect()
    node?.port.close()
    void audio.close().catch(() => {})
    queue.length = 0
    resolveResult(transcript)
  }

  const setupTimer = window.setTimeout(() => close('setup-timeout'), 2_500)
  if (audio.sampleRate !== SAMPLE_RATE || !audio.audioWorklet) {
    close('unsupported-audio')
    return null
  }

  const sendQueued = (initial = false) => {
    if (!ready || socket?.readyState !== WebSocket.OPEN || sendTimer !== undefined) return
    try {
      if (socket.bufferedAmount > MAX_BUFFERED_BYTES) { close('network-backlog'); return }
      const first = queue.shift()
      if (first) {
        queuedBytes -= first.byteLength
        if (initial && queue.length > 0) {
          const batch = new Uint8Array(MAX_CHUNK_BYTES)
          batch.set(new Uint8Array(first))
          let length = first.byteLength
          while (queue[0] && length + queue[0].byteLength <= MAX_CHUNK_BYTES) {
            const chunk = queue.shift()!
            batch.set(new Uint8Array(chunk), length)
            length += chunk.byteLength
            queuedBytes -= chunk.byteLength
          }
          socket.send(batch.subarray(0, length))
        } else {
          socket.send(first)
        }
        if (queue.length > 0) {
          sendTimer = window.setTimeout(() => {
            sendTimer = undefined
            sendQueued()
          }, FRAME_MS)
          return
        }
      }
      if (flushed && !awaitingFinal) {
        awaitingFinal = true
        socket.send(JSON.stringify({ type: 'ForceEndpoint' }))
      }
    } catch {
      close('send-error')
    }
  }

  const openSocket = async () => {
    const token = await session.token
    if (closed) return
    if (!token) { close('token-unavailable'); return }
    const url = new URL('wss://streaming.assemblyai.com/v3/ws')
    url.search = new URLSearchParams({
      token,
      speech_model: 'assemblyai-stt-3-7-realtime-agent',
      sample_rate: String(SAMPLE_RATE),
      encoding: 'pcm_s16le',
      mode: 'manual',
    }).toString()
    const connection = new WebSocket(url)
    socket = connection
    connection.onerror = () => close('websocket-error')
    connection.onclose = (event) => close(`websocket-close-${event.code}`)
    connection.onmessage = (event) => {
      if (closed || typeof event.data !== 'string') return
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'Begin' && !ready) {
          ready = true
          window.clearTimeout(setupTimer)
          sendQueued(true)
        } else if (awaitingFinal && message.type === 'Turn' && message.end_of_turn === true) {
          const transcript = typeof message.transcript === 'string'
            ? message.transcript.replace(/\s+/g, ' ').replace(/^[.,!?;:]+$/, '').trim().slice(0, 500)
            : ''
          close('empty-transcript', transcript || null)
        }
      } catch {
        close('invalid-message')
      }
    }
  }

  const capturePcm = (stream: MediaStream) => {
    source = audio.createMediaStreamSource(stream)
    node = new AudioWorkletNode(audio, 'buddy-pcm', { channelCount: 1, channelCountMode: 'explicit' })
    node.port.onmessage = ({ data }: MessageEvent<ArrayBuffer | 'flushed'>) => {
      if (closed) return
      if (data === 'flushed') {
        flushed = true
      } else {
        queuedBytes += data.byteLength
        if (queuedBytes > MAX_BUFFERED_BYTES) { close('setup-backlog'); return }
        queue.push(data)
      }
      sendQueued()
    }
    node.onprocessorerror = () => close('worklet-processing-error')
    source.connect(node).connect(audio.destination)
  }

  const workletUrl = URL.createObjectURL(new Blob([workletSource], { type: 'text/javascript' }))
  const loadWorklet = audio.audioWorklet.addModule(workletUrl).finally(() => URL.revokeObjectURL(workletUrl))
  const worklet = Promise.all([loadWorklet, audio.resume()])
  void worklet.catch(() => close('worklet-load-error'))
  void openSocket().catch(() => close('session-request-error'))

  return {
    attach(stream) {
      const recordingStarted = performance.now()
      void worklet.then(() => {
        // Keep the full recording when worklet setup missed the start of an utterance.
        if (closed) return
        if (performance.now() - recordingStarted > 180) { close('late-microphone-attach'); return }
        capturePcm(stream)
      }).catch(() => close('microphone-attach-error'))
    },
    finish() {
      if (!closed && !node) close('stopped-before-ready')
      if (!closed && finalTimer === undefined) {
        finalTimer = window.setTimeout(() => close('final-timeout'), FINAL_TIMEOUT_MS)
        node?.port.postMessage('flush')
      }
      return result
    },
    cancel: () => close('cancelled'),
  }
}
